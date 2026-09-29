import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

const MCP_SERVER_MANIFEST = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  name: 'nanoai-agent-tools',
  version: '1.0.0',
  description: 'Bộ công cụ Model Context Protocol (MCP) của NanoAI cho tác nhân duyệt web và trợ lý AI.',
  homepage: 'https://nanoai.vn',
  documentation: 'https://nanoai.vn/llms.txt',
  tools: [
    {
      name: 'virtual_try_on',
      description: 'Thử trang phục hoặc quần áo lên ảnh người mẫu thực tế bằng AI.',
      inputSchema: {
        type: 'object',
        properties: {
          person_image_url: { type: 'string', description: 'URL ảnh người mẫu hoặc khách hàng' },
          garment_image_url: { type: 'string', description: 'URL ảnh trang phục cần thử' },
          category: { type: 'string', enum: ['tops', 'bottoms', 'dresses', 'all'], default: 'all' },
        },
        required: ['person_image_url', 'garment_image_url'],
      },
    },
    {
      name: 'generate_packaging_dieline',
      description: 'Tạo bản vẽ dieline bao bì hộp carton hoặc nhãn chai 2D/3D theo kích thước chính xác.',
      inputSchema: {
        type: 'object',
        properties: {
          box_type: { type: 'string', description: 'Loại cấu trúc hộp (snap-lock, tuck-end, shipper...)' },
          length_mm: { type: 'number', description: 'Chiều dài hộp (mm)' },
          width_mm: { type: 'number', description: 'Chiều rộng hộp (mm)' },
          height_mm: { type: 'number', description: 'Chiều cao hộp (mm)' },
        },
        required: ['box_type', 'length_mm', 'width_mm', 'height_mm'],
      },
    },
    {
      name: 'synthesize_vietnamese_speech',
      description: 'Tổng hợp văn bản tiếng Việt thành giọng nói tự nhiên, truyền cảm.',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Văn bản tiếng Việt cần đọc' },
          voice: { type: 'string', description: 'Mã giọng đọc (ví dụ: hn_male, sg_female)' },
          speed: { type: 'number', default: 1.0 },
        },
        required: ['text'],
      },
    },
    {
      name: 'generate_studio_banner',
      description: 'Tạo banner quảng cáo hoặc ảnh sản phẩm thương mại điện tử chuyên nghiệp.',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Mô tả ý tưởng banner hoặc phong cách ảnh sản phẩm' },
          aspect_ratio: { type: 'string', enum: ['21:9', '16:9', '1:1', '9:16'], default: '21:9' },
        },
        required: ['prompt'],
      },
    },
  ],
}

export function GET() {
  return NextResponse.json(MCP_SERVER_MANIFEST, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
