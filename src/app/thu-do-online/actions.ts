'use server'

import sharp from 'sharp'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai'
import { removeFaceFromGarmentImages } from '@/lib/remove-face-garment-server'
import { normalizeToEnglish } from '@/lib/ai-normalize'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

/** Tính tỷ lệ gần nhất từ kích thước ảnh gốc – dùng cho try-on để giữ framing như input */
async function getAspectRatioFromImage(buffer: Buffer): Promise<string> {
  const { width, height } = await sharp(buffer).metadata()
  if (!width || !height) return '1:1'
  const ratio = width / height
  const targets: [string, number][] = [
    ['1:1', 1],
    ['2:3', 2 / 3],
    ['3:2', 3 / 2],
    ['3:4', 3 / 4],
    ['4:3', 4 / 3],
    ['9:16', 9 / 16],
    ['16:9', 16 / 9],
    ['21:9', 21 / 9],
  ]
  let best = '1:1'
  let bestDiff = Infinity
  for (const [label, target] of targets) {
    const diff = Math.abs(ratio - target)
    if (diff < bestDiff) {
      bestDiff = diff
      best = label
    }
  }
  return best
}


const costMap = {
  single: 1,
  couple: 1.2,
  group: 1.3,
  group4: 1.4,
  group5: 1.5,
};

const toTenths = (value: number) => Math.round(value * 10)
const fromTenths = (value: number) => value / 10
const formatCredits = (value: number) => value.toLocaleString('vi-VN', { maximumFractionDigits: 1 })

function buildSinglePersonPrompt(genderLabel: string, customPrompt: string, garmentCount: number): string {
  return `
    CRITICAL: Output must be ONE full-frame photo (same composition as input). NEVER a 2x2 grid, 4 panels, or multiple copies.

    Task: Virtual Try-On for 1 person.

    INPUT (image order):
    - Image 1: Customer (person to try on) – sole person in frame.
    - Next ${garmentCount} images: Model wearing product – apply ALL garments to customer in Image 1.
    - Gender: ${genderLabel}.

    IDENTIFY IMAGES:
    - Image 1 = customer to try on.
    - Images 2 to ${1 + garmentCount} = product images, apply ALL to customer in Image 1.

    INSTRUCTIONS:
    1. Take GARMENTS from model images and dress the customer in Image 1.
    2. Customer image: keep face, body, pose, background unchanged. Change only garments.
    3. Product images: ignore model, extract only clothing to dress customer.
    4. Garments must look natural, correct fit, preserve product details.

    ${customPrompt ? `ADDITIONAL USER REQUEST: "${customPrompt}"` : ''}

    OUTPUT FORMAT (CRITICAL):
    - Return exactly ONE image with the SAME framing as Image 1 (customer photo).
    - The person must fill the entire frame – one full-frame photo, NOT a 2x2 grid, NOT 4 panels, NOT multiple copies.
    - Forbidden: grid layout, collage, 4 identical thumbnails, 2x2 arrangement.
    - Output = single full-frame image, same composition as input.
  `;
}

function buildCouplePrompt(customPrompt: string, leftCount: number, rightCount: number): string {
  return `
    CRITICAL: Output must be ONE full-frame photo (same composition as input). NEVER a 2x2 grid, 4 panels, or multiple copies.

    Task: Virtual Try-On for couple (2 people).

    INPUT (image order):
    - Image 1: Two customers (to try on), left to right.
    - Next ${leftCount} images: Model wearing product for Left person (left in frame).
    - Next ${rightCount} images: Model wearing product for Right person (right in frame).

    IDENTIFY POSITIONS (left to right):
    - Left person: Left in customer image (Image 1) – receives garments from first ${leftCount} product images.
    - Right person: Right in customer image (Image 1) – receives garments from last ${rightCount} product images.

    INSTRUCTIONS:
    1. Take GARMENTS from model images and dress each customer. Apply correct product group to correct person in order.
    2. Customer image: keep faces, bodies, poses, positions, background unchanged. Change only garments.
    3. Product images: ignore models, extract only clothing for customers.
    4. Garments on each person must look natural, correct fit, preserve product details.

    ${customPrompt ? `ADDITIONAL USER REQUEST: "${customPrompt}"` : ''}

    OUTPUT FORMAT (CRITICAL):
    - Return exactly ONE image with the SAME framing as Image 1. One full-frame photo.
    - Forbidden: 2x2 grid, 4 panels, collage, multiple copies.
  `;
}


function buildGroupPrompt(customPrompt: string, leftCount: number, middleCount: number, rightCount: number): string {
  return `
    CRITICAL: Output must be ONE full-frame photo (same composition as input). NEVER a 2x2 grid, 4 panels, or multiple copies.

    Task: Virtual Try-On for group of 3.

    INPUT (image order):
    - Image 1: Three customers (to try on), left to right.
    - Next ${leftCount} images: Model wearing product for Left person (leftmost).
    - Next ${middleCount} images: Model wearing product for Middle person (center).
    - Next ${rightCount} images: Model wearing product for Right person (rightmost).

    IDENTIFY POSITIONS (left to right):
    - Left: Leftmost in customer image (Image 1) – receives garments from first ${leftCount} product images.
    - Middle: Center in customer image (Image 1) – receives garments from next ${middleCount} product images.
    - Right: Rightmost in customer image (Image 1) – receives garments from last ${rightCount} product images.

    INSTRUCTIONS:
    1. Take GARMENTS from model images and dress each customer. Apply correct product group to correct person in order.
    2. Customer image: keep faces, bodies, poses, positions, background unchanged. Change only garments.
    3. Product images: ignore models, extract only clothing for customers.
    4. Garments on each person must look natural, correct fit, preserve product details.

    ${customPrompt ? `ADDITIONAL USER REQUEST: "${customPrompt}"` : ''}

    OUTPUT FORMAT (CRITICAL):
    - Return exactly ONE image with the SAME framing as Image 1. One full-frame photo.
    - Forbidden: 2x2 grid, 4 panels, collage, multiple copies.
  `;
}


function buildFourPersonPrompt(customPrompt: string, p1Count: number, p2Count: number, p3Count: number, p4Count: number): string {
  return `
    CRITICAL: Output must be ONE full-frame photo (same composition as input). NEVER a 2x2 grid, 4 panels, or multiple copies.

    Task: Virtual Try-On for group of 4.

    INPUT (image order):
    - Image 1: Four customers (to try on), left to right.
    - Next ${p1Count} images: Model wearing product for Person 1 (leftmost).
    - Next ${p2Count} images: Model wearing product for Person 2 (second from left).
    - Next ${p3Count} images: Model wearing product for Person 3 (third from left).
    - Last ${p4Count} images: Model wearing product for Person 4 (rightmost).

    IDENTIFY POSITIONS (left to right):
    - Person 1: Leftmost in customer image (Image 1) – receives garments from first ${p1Count} product images.
    - Person 2: Second from left – receives garments from next ${p2Count} product images.
    - Person 3: Third from left – receives garments from next ${p3Count} product images.
    - Person 4: Rightmost – receives garments from last ${p4Count} product images.

    INSTRUCTIONS:
    1. Take GARMENTS from model images and dress each customer. Apply correct product group to correct person in order.
    2. Customer image: keep faces, bodies, poses, positions, background unchanged. Change only garments.
    3. Product images: ignore models, extract only clothing for customers.
    4. Garments on each person must look natural, correct fit, preserve product details.

    ${customPrompt ? `ADDITIONAL USER REQUEST: "${customPrompt}"` : ''}

    OUTPUT FORMAT (CRITICAL):
    - Return exactly ONE image with the SAME framing as Image 1. One full-frame photo.
    - Forbidden: 2x2 grid, 4 panels, collage, multiple copies.
  `;
}


function buildFivePersonPrompt(customPrompt: string, p1Count: number, p2Count: number, p3Count: number, p4Count: number, p5Count: number): string {
  return `
    CRITICAL: Output must be ONE full-frame photo (same composition as input). NEVER a 2x2 grid, 4 panels, or multiple copies.

    Task: Virtual Try-On for group of 5.

    INPUT (image order):
    - Image 1: Five customers (to try on), left to right.
    - Next ${p1Count} images: Model wearing product for Person 1 (leftmost).
    - Next ${p2Count} images: Model wearing product for Person 2 (second from left).
    - Next ${p3Count} images: Model wearing product for Person 3 (center).
    - Next ${p4Count} images: Model wearing product for Person 4 (fourth from left).
    - Last ${p5Count} images: Model wearing product for Person 5 (rightmost).

    IDENTIFY POSITIONS (left to right):
    - Person 1: Leftmost in customer image (Image 1) – receives garments from first ${p1Count} product images.
    - Person 2: Second from left – receives garments from next ${p2Count} product images.
    - Person 3: Center – receives garments from next ${p3Count} product images.
    - Person 4: Fourth from left – receives garments from next ${p4Count} product images.
    - Person 5: Rightmost – receives garments from last ${p5Count} product images.

    INSTRUCTIONS:
    1. Take GARMENTS from model images and dress each customer. Apply correct product group to correct person in order.
    2. Customer image: keep faces, bodies, poses, positions, background unchanged. Change only garments.
    3. Product images: ignore models, extract only clothing for customers.
    4. Garments on each person must look natural, correct fit, preserve product details.

    ${customPrompt ? `ADDITIONAL USER REQUEST: "${customPrompt}"` : ''}

    OUTPUT FORMAT (CRITICAL):
    - Return exactly ONE image with the SAME framing as Image 1. One full-frame photo.
    - Forbidden: 2x2 grid, 4 panels, collage, multiple copies.
  `;
}

export async function generateAiImage(formData: FormData) {
  const userImage = formData.get('userImage') as File;
  const customPrompt = formData.get('customPrompt') as string || '';
  const tryOnMode = formData.get('tryOnMode') as 'single' | 'couple' | 'group' | 'group4' | 'group5';
  const imageQuality = (formData.get('imageQuality') as '2K' | '4K') || '2K';

  const garmentImages: File[] = [];
  const leftGarmentImages: File[] = [];
  const middleGarmentImages: File[] = [];
  const rightGarmentImages: File[] = [];
  const person1Images: File[] = [], person2Images: File[] = [], person3Images: File[] = [], person4Images: File[] = [], person5Images: File[] = [];
  let prompt = '';

  if (tryOnMode === 'single') {
    const count = parseInt(formData.get('garmentCount') as string || '0');
    for (let i = 0; i < count; i++) if (formData.get(`garmentImage${i}`)) garmentImages.push(formData.get(`garmentImage${i}`) as File);
    if (!userImage || userImage.size === 0 || garmentImages.length === 0) return { error: 'Cần có ảnh người dùng và ít nhất một ảnh sản phẩm.' };
  } else if (tryOnMode === 'couple') {
    const leftCount = parseInt(formData.get('leftGarmentCount') as string || '0');
    const rightCount = parseInt(formData.get('rightGarmentCount') as string || '0');
    for (let i = 0; i < leftCount; i++) if (formData.get(`leftGarmentImage${i}`)) leftGarmentImages.push(formData.get(`leftGarmentImage${i}`) as File);
    for (let i = 0; i < rightCount; i++) if (formData.get(`rightGarmentImage${i}`)) rightGarmentImages.push(formData.get(`rightGarmentImage${i}`) as File);
    if (!userImage || userImage.size === 0 || (leftGarmentImages.length === 0 && rightGarmentImages.length === 0)) return { error: 'Cần có ảnh người dùng và ít nhất một ảnh sản phẩm cho một trong hai người.' };
  } else if (tryOnMode === 'group') {
    const leftCount = parseInt(formData.get('leftGarmentCount') as string || '0');
    const middleCount = parseInt(formData.get('middleGarmentCount') as string || '0');
    const rightCount = parseInt(formData.get('rightGarmentCount') as string || '0');
    for (let i = 0; i < leftCount; i++) if (formData.get(`leftGarmentImage${i}`)) leftGarmentImages.push(formData.get(`leftGarmentImage${i}`) as File);
    for (let i = 0; i < middleCount; i++) if (formData.get(`middleGarmentImage${i}`)) middleGarmentImages.push(formData.get(`middleGarmentImage${i}`) as File);
    for (let i = 0; i < rightCount; i++) if (formData.get(`rightGarmentImage${i}`)) rightGarmentImages.push(formData.get(`rightGarmentImage${i}`) as File);
    if (!userImage || userImage.size === 0 || (leftGarmentImages.length === 0 && middleGarmentImages.length === 0 && rightGarmentImages.length === 0)) return { error: 'Cần có ảnh người dùng và ít nhất một ảnh sản phẩm cho một trong ba người.' };
  } else if (tryOnMode === 'group4') {
    const p1Count = parseInt(formData.get('person1Count') as string || '0');
    const p2Count = parseInt(formData.get('person2Count') as string || '0');
    const p3Count = parseInt(formData.get('person3Count') as string || '0');
    const p4Count = parseInt(formData.get('person4Count') as string || '0');
    for (let i = 0; i < p1Count; i++) if (formData.get(`person1Image${i}`)) person1Images.push(formData.get(`person1Image${i}`) as File);
    for (let i = 0; i < p2Count; i++) if (formData.get(`person2Image${i}`)) person2Images.push(formData.get(`person2Image${i}`) as File);
    for (let i = 0; i < p3Count; i++) if (formData.get(`person3Image${i}`)) person3Images.push(formData.get(`person3Image${i}`) as File);
    for (let i = 0; i < p4Count; i++) if (formData.get(`person4Image${i}`)) person4Images.push(formData.get(`person4Image${i}`) as File);
    if (!userImage || userImage.size === 0 || (person1Images.length === 0 && person2Images.length === 0 && person3Images.length === 0 && person4Images.length === 0)) return { error: 'Cần có ảnh người dùng và ít nhất một ảnh sản phẩm cho một trong bốn người.' };
  } else if (tryOnMode === 'group5') {
    const p1Count = parseInt(formData.get('person1Count') as string || '0');
    const p2Count = parseInt(formData.get('person2Count') as string || '0');
    const p3Count = parseInt(formData.get('person3Count') as string || '0');
    const p4Count = parseInt(formData.get('person4Count') as string || '0');
    const p5Count = parseInt(formData.get('person5Count') as string || '0');
    for (let i = 0; i < p1Count; i++) if (formData.get(`person1Image${i}`)) person1Images.push(formData.get(`person1Image${i}`) as File);
    for (let i = 0; i < p2Count; i++) if (formData.get(`person2Image${i}`)) person2Images.push(formData.get(`person2Image${i}`) as File);
    for (let i = 0; i < p3Count; i++) if (formData.get(`person3Image${i}`)) person3Images.push(formData.get(`person3Image${i}`) as File);
    for (let i = 0; i < p4Count; i++) if (formData.get(`person4Image${i}`)) person4Images.push(formData.get(`person4Image${i}`) as File);
    for (let i = 0; i < p5Count; i++) if (formData.get(`person5Image${i}`)) person5Images.push(formData.get(`person5Image${i}`) as File);
    if (!userImage || userImage.size === 0 || (person1Images.length === 0 && person2Images.length === 0 && person3Images.length === 0 && person4Images.length === 0 && person5Images.length === 0)) return { error: 'Cần có ảnh người dùng và ít nhất một ảnh sản phẩm cho một trong năm người.' };
  }

  const supabase = createClient()
  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const result = await getUserForAction(() => supabase.auth.getUser(), 'Authentication required.')
  if ('error' in result) return { error: result.error }
  const { user } = result

  const gender = (user.user_metadata?.gender as string) || 'male'
  const genderLabel = gender === 'female' ? 'female' : 'male'
  const customPromptEn = (customPrompt?.trim()) ? await normalizeToEnglish(customPrompt.trim()) : ''

  if (tryOnMode === 'single') {
    prompt = buildSinglePersonPrompt(genderLabel, customPromptEn, garmentImages.length);
  } else if (tryOnMode === 'couple') {
    prompt = buildCouplePrompt(customPromptEn, leftGarmentImages.length, rightGarmentImages.length);
  } else if (tryOnMode === 'group') {
    prompt = buildGroupPrompt(customPromptEn, leftGarmentImages.length, middleGarmentImages.length, rightGarmentImages.length);
  } else if (tryOnMode === 'group4') {
    prompt = buildFourPersonPrompt(customPromptEn, person1Images.length, person2Images.length, person3Images.length, person4Images.length);
  } else if (tryOnMode === 'group5') {
    prompt = buildFivePersonPrompt(customPromptEn, person1Images.length, person2Images.length, person3Images.length, person4Images.length, person5Images.length);
  }

  const baseCost = costMap[tryOnMode];
  const cost = imageQuality === '4K' ? baseCost * 2.2 : baseCost;

  const { data: creditData, error: creditError } = await supabase.from('credits').select('balance').eq('user_id', user.id).single()
  if (creditError || !creditData || toTenths(creditData.balance) < toTenths(cost)) {
    return { error: `Không đủ credits. Bạn cần ${formatCredits(cost)} credits, nhưng chỉ có ${formatCredits(creditData?.balance || 0)}.` }
  }

  const timestamp = Date.now()
  const userImagePath = `uploads/${user.id}/user_${timestamp}.png`
  const { error: userImageError } = await supabase.storage.from('try-on-images').upload(userImagePath, userImage)
  if (userImageError) return { error: 'Failed to upload user image.' }

  const allGarmentImages = [...garmentImages, ...leftGarmentImages, ...middleGarmentImages, ...rightGarmentImages, ...person1Images, ...person2Images, ...person3Images, ...person4Images, ...person5Images];

  // Xóa mặt người mẫu khỏi ảnh sản phẩm (Vision API) trước khi gửi AI – lỗi thì báo ngay, không fallback
  let processedGarmentImages: File[];
  try {
    processedGarmentImages = await removeFaceFromGarmentImages(allGarmentImages);
  } catch (visionErr) {
    const msg = visionErr instanceof Error ? visionErr.message : String(visionErr);
    return { error: `Vision API lỗi: ${msg}` };
  }

  const garmentImageUrls: string[] = [];
  for (let i = 0; i < processedGarmentImages.length; i++) {
    const path = `uploads/${user.id}/garment_${i}_${timestamp}.png`;
    await supabase.storage.from('try-on-images').upload(path, processedGarmentImages[i]);
    const { data } = supabase.storage.from('try-on-images').getPublicUrl(path);
    garmentImageUrls.push(data.publicUrl);
  }
  const { data: userImageUrl } = supabase.storage.from('try-on-images').getPublicUrl(userImagePath)

  const { data: historyItem, error: historyError } = await supabase.from('try_on_history').insert({ 
    user_id: user.id, 
    original_image_url: userImageUrl.publicUrl, 
    garment_image_url: garmentImageUrls[0] || null,
    status: 'processing' 
  }).select().single()
  
  console.log('History insert result:', { historyItem, historyError })
  
  if (historyError || !historyItem) {
    console.error('Failed to initialize try-on session:', historyError)
    return { error: 'Failed to initialize try-on session.' }
  }

  const userImageBuffer = Buffer.from(await userImage.arrayBuffer());
  const aspectRatio = await getAspectRatioFromImage(userImageBuffer);
  console.log('Try-on aspect ratio from input image:', aspectRatio);

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
  const modelName = "gemini-3-pro-image-preview";
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: {
        imageSize: imageQuality === '4K' ? '4K' : '2K',
        aspectRatio,
      },
    },
  });

  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  ];

  const imageParts = [
    { inlineData: { data: userImageBuffer.toString("base64"), mimeType: userImage.type } },
    ...(await Promise.all(processedGarmentImages.map(async (img) => ({
      inlineData: { data: Buffer.from(await img.arrayBuffer()).toString("base64"), mimeType: img.type },
    }))))
  ];

  try {
    console.log(`Attempting to generate image with model: ${modelName} (${imageQuality}), Cost: ${cost} credits`);
    const result = await model.generateContent([prompt, ...imageParts], { safetySettings });
    const response = result.response;
    trackFromUsageMetadata(response.usageMetadata, modelName, 'thu-do-online', user.id, imageQuality === '4K' ? '4K' : '2K');
    console.log("AI Response:", JSON.stringify(response, null, 2));
    
    const imagePart = response.candidates?.[0].content.parts.find(part => 'inlineData' in part);
    if (!imagePart || !('inlineData' in imagePart)) {
      throw new Error(`AI did not return a valid image. Full response: ${JSON.stringify(response)}`);
    }

    const resultImageBase64 = imagePart.inlineData.data;
    const resultImageBuffer = Buffer.from(resultImageBase64, 'base64');
    const resultImagePath = `results/${user.id}/try-on_${timestamp}.png`;

    await supabase.storage.from('try-on-images').upload(resultImagePath, resultImageBuffer, { contentType: 'image/png', upsert: true });
    const { data: resultImageUrlData } = supabase.storage.from('try-on-images').getPublicUrl(resultImagePath);
    const resultImageUrl = resultImageUrlData.publicUrl;

    const { data: latestCreditData, error: latestCreditError } = await adminSupabase
      .from('credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    if (latestCreditError || !latestCreditData) {
      throw new Error('Không thể đọc số dư credit hiện tại để trừ credit.')
    }
    if (toTenths(latestCreditData.balance) < toTenths(cost)) {
      throw new Error(`Không đủ credits để hoàn tất giao dịch. Cần ${formatCredits(cost)}, hiện có ${formatCredits(latestCreditData.balance)}.`)
    }

    const newBalance = fromTenths(toTenths(latestCreditData.balance) - toTenths(cost))
    const { error: deductCreditError } = await adminSupabase
      .from('credits')
      .update({ balance: newBalance })
      .eq('user_id', user.id)

    if (deductCreditError) {
      throw new Error('Đã tạo ảnh nhưng không thể trừ credit. Vui lòng thử lại.')
    }

    const { error: updateHistoryError } = await adminSupabase
      .from('try_on_history')
      .update({ result_image_url: resultImageUrl, status: 'completed' })
      .eq('id', historyItem.id)

    if (updateHistoryError) {
      throw new Error('Đã tạo ảnh và trừ credit, nhưng không thể cập nhật lịch sử thử đồ.')
    }

    revalidatePath('/thu-do-online');
    revalidatePath('/dashboard/history');
    return { success: true, resultUrl: resultImageUrl };
  } catch (aiError: unknown) {
    console.error('Generate try-on failed:', aiError);
    await adminSupabase.from('try_on_history').delete().eq('id', historyItem.id);
    revalidatePath('/dashboard');
    const aiErrorMessage = aiError instanceof Error ? aiError.message : 'Unknown error'
    if (/500|Internal Server Error|Internal error/i.test(aiErrorMessage)) {
      return { error: 'Hệ thống quá tải. Bạn có thể chọn 2K hoặc thử lại sau ít phút.' }
    }
    return { error: `Failed to generate AI image: ${aiErrorMessage}` };
  }
}
