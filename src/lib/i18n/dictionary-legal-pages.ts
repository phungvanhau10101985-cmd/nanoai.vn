import { MERCHANT_CENTER_PAGES } from '@/lib/i18n/dictionary-merchant-center-pages'

export type LegalSection = { heading: string; paragraphs: string[] }

export type LegalPageDoc = {
  pageTitle: string
  metaDescription: string
  lastUpdated: string
  sections: LegalSection[]
}

export type DataDeletionDoc = {
  pageTitle: string
  metaDescription: string
  intro: string
  stepsTitle: string
  steps: string[]
  outro: string
}

/** Nội dung trang pháp lý phục vụ URL công khai (Meta Developer, v.v.) */
export type LegalPagesBundle = {
  privacy: LegalPageDoc
  terms: LegalPageDoc
  /** /chinh-sach-doi-tra — URL Google Merchant Center đọc chính sách trả lại */
  returns: LegalPageDoc
  /** /chinh-sach-giao-hang — phí và thời gian giao Merchant Center đối chiếu */
  shipping: LegalPageDoc
  /** /chinh-sach-thanh-toan — cách thanh toán và số tiền trước khi mua */
  payment: LegalPageDoc
  /** /lien-he — email và kênh liên hệ công khai */
  contact: LegalPageDoc
  dataDeletion: DataDeletionDoc
}

const VI = {
  privacy: {
    pageTitle: 'Chính sách quyền riêng tư',
    metaDescription:
      'Chính sách quyền riêng tư của NanoAI: dữ liệu thu thập, mục đích sử dụng, bảo mật và quyền của người dùng.',
    lastUpdated: 'Cập nhật lần cuối: 15/05/2026',
    sections: [
      {
        heading: '1. Phạm vi',
        paragraphs: [
          'Chính sách này áp dụng cho website và dịch vụ NanoAI (sau đây gọi là “Dịch vụ”). Bằng việc sử dụng Dịch vụ, bạn xác nhận đã đọc và hiểu cách chúng tôi xử lý thông tin.',
          'Nếu bạn không đồng ý, vui lòng không tiếp tục sử dụng Dịch vụ.',
        ],
      },
      {
        heading: '2. Dữ liệu chúng tôi có thể thu thập',
        paragraphs: [
          'Thông tin tài khoản (như email đăng nhập), dữ liệu bạn gửi lên khi dùng công cụ (ví dụ: ảnh, văn bản), thông tin giao dịch và tín dụng khi có thanh toán, nhật ký kỹ thuật (IP, thiết bị, trình duyệt) phục vụ vận hành và bảo mật.',
          'Chúng tôi không cố ý thu thập dữ liệu trẻ em dưới 13 tuổi. Nếu bạn là phụ huynh và phát hiện trường hợp này, hãy liên hệ để chúng tôi hỗ trợ xóa.',
        ],
      },
      {
        heading: '3. Mục đích sử dụng',
        paragraphs: [
          'Cung cấp và cải thiện Dịch vụ; xác thực tài khoản; xử lý thanh toán; hỗ trợ khách hàng; phòng chống gian lận, lạm dụng; tuân thủ nghĩa vụ pháp lý khi có yêu cầu.',
          'Nội dung do AI tạo mang tính tự động: bạn chịu trách nhiệm đánh giá mức độ phù hợp trước khi sử dụng công khai hoặc thương mại.',
        ],
      },
      {
        heading: '4. Cơ sở pháp lý và chia sẻ',
        paragraphs: [
          'Chúng tôi chỉ chia sẻ dữ liệu với nhà cung cấp cần thiết để vận hành Dịch vụ (ví dụ: hạ tầng, thanh toán, gửi email), kèm hợp đồng/xử lý dữ liệu phù hợp.',
          'Chúng tôi không bán thông tin liên hệ hoặc dữ liệu cá nhân của người dùng.',
          'Có thể công bố dữ liệu khi pháp luật yêu cầu hoặc để bảo vệ quyền, an toàn của người dùng và NanoAI.',
        ],
      },
      {
        heading: '5. Bảo mật và lưu trữ',
        paragraphs: [
          'Chúng tôi áp dụng biện pháp kỹ thuật và tổ chức hợp lý để bảo vệ dữ liệu; không có hệ thống nào an toàn tuyệt đối.',
          'Thời gian lưu trữ phụ thuộc mục đích xử lý và yêu cầu pháp luật; khi không còn cần thiết, chúng tôi xóa hoặc ẩn danh hóa tùy quy trình kỹ thuật.',
        ],
      },
      {
        heading: '6. Quyền của bạn và liên hệ',
        paragraphs: [
          'Tùy luật hiện hành, bạn có thể yêu cầu truy cập, chỉnh sửa, xóa, hạn chế, phản đối hoặc chuyển dữ liệu; có thể rút lại đồng ý xử lý trong phạm vi pháp luật cho phép.',
          'Liên hệ: support@nanoai.vn hoặc kênh hỗ trợ trong ứng dụng. Chúng tôi sẽ phản hồi trong thời gian hợp lý sau khi xác minh danh tính khi cần.',
        ],
      },
    ],
  },
  terms: {
    pageTitle: 'Điều khoản dịch vụ',
    metaDescription:
      'Điều khoản sử dụng NanoAI: quyền và nghĩa vụ người dùng, giới hạn trách nhiệm và nội dung do AI tạo.',
    lastUpdated: 'Cập nhật lần cuối: 15/05/2026',
    sections: [
      {
        heading: '1. Chấp nhận điều khoản',
        paragraphs: [
          'Khi truy cập hoặc dùng Dịch vụ NanoAI, bạn đồng ý Điều khoản này và Chính sách quyền riêng tư.',
          'Nếu bạn sử dụng thay mặt tổ chức, bạn bảo đảm có thẩm quyền ràng buộc tổ chức đó.',
        ],
      },
      {
        heading: '2. Mô tả dịch vụ',
        paragraphs: [
          'NanoAI cung cấp công cụ và tính năng AI trên nền tảng web; từng tính năng có thể có điều kiện hoặc giới hạn riêng được thông báo trên giao diện.',
          'Chúng tôi có thể thay đổi, tạm ngưng hoặc ngừng một phần Dịch vụ để bảo trì hoặc lý do hợp lý; sẽ cố gắng thông báo trước khi ảnh hưởng đáng kể.',
        ],
      },
      {
        heading: '3. Tài khoản và thanh toán',
        paragraphs: [
          'Bạn chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động dưới tài khoản của mình.',
          'Phí dịch vụ, tín dụng và thanh toán tuân theo mô tả trên trang tại thời điểm giao dịch. Hoàn tiền theo Chính sách đổi trả tại https://nanoai.vn/chinh-sach-doi-tra: 30 ngày kể từ ngày giao dịch vụ (trùng ngày thanh toán), áp dụng cho dịch vụ khiếm khuyết và trường hợp đổi ý, phí vận chuyển trả hàng 0 VND, phí nhập kho 0 VND, hoàn toàn bộ về phương thức thanh toán ban đầu trong 7 ngày làm việc.',
          'Giao dịch vụ theo https://nanoai.vn/chinh-sach-giao-hang: phí giao 0 VND, thời gian xử lý 0 ngày, thời gian vận chuyển 0 ngày, giao trong ngày thanh toán từ Việt Nam. Thanh toán theo https://nanoai.vn/chinh-sach-thanh-toan: chuyển khoản ngân hàng bằng VND, số tiền hiển thị đầy đủ trước khi khách xác nhận.',
        ],
      },
      {
        heading: '4. Nội dung do AI và nội dung người dùng',
        paragraphs: [
          'Đầu ra AI có thể không chính xác hoặc đầy đủ; bạn tự chịu trách nhiệm khi dựa vào đó trong quyết định quan trọng.',
          'Bạn giữ quyền đối với nội dung bạn tải lên trong phạm vi pháp luật; bạn cấp cho NanoAI giấy phép vận hành, xử lý phục vụ Dịch vụ và cải thiện chất lượng trong giới hạn cần thiết.',
        ],
      },
      {
        heading: '5. Hành vi cấm',
        paragraphs: [
          'Cấm sử dụng Dịch vụ cho hành vi bất hợp pháp, xâm phạm quyền người khác, phát tán mã độc, tấn công hệ thống, hoặc vượt quá giới hạn sử dụng hợp lệ.',
        ],
      },
      {
        heading: '6. Giới hạn trách nhiệm',
        paragraphs: [
          'Trong phạm vi pháp luật cho phép, NanoAI và đối tác không chịu trách nhiệm với thiệt hại gián tiếp, ngẫu nhiên, hệ quả.',
          'Trách nhiệm tổng (nếu có) không vượt quá số tiền bạn đã trả cho Dịch vụ liên quan sự kiện đó trong một khoảng thời gian hợp lý được quy định tại đây với người tiêu dùng theo luật Việt Nam khi áp dụng.',
        ],
      },
    ],
  },
  returns: {
    pageTitle: 'Chính sách đổi trả và hoàn tiền',
    metaDescription:
      'NanoAI hoàn tiền trong 30 ngày cho dịch vụ công nghệ thông tin khiếm khuyết và trường hợp đổi ý. Phí vận chuyển trả hàng 0 VND.',
    lastUpdated: 'Cập nhật lần cuối: 19/10/2026',
    sections: [
      {
        heading: '1. Tóm tắt',
        paragraphs: [
          'Thời hạn trả lại: 30 ngày, tính từ ngày giao dịch vụ. Dịch vụ công nghệ thông tin trên nanoai.vn được giao vào đúng ngày thanh toán.',
          'NanoAI chấp nhận trả lại dịch vụ khiếm khuyết và dịch vụ không khiếm khuyết, kể cả trường hợp khách đổi ý.',
          'Phí vận chuyển trả hàng: 0 VND. Phí nhập kho: 0 VND.',
          'Hoàn toàn bộ số tiền đã thanh toán về đúng phương thức thanh toán ban đầu, trong 7 ngày làm việc sau khi yêu cầu được chấp nhận.',
          'Phương thức trả lại: gửi email tới support@nanoai.vn. Không cần gửi hàng hóa vật lý.',
        ],
      },
      {
        heading: '2. Phạm vi',
        paragraphs: [
          'Chính sách này áp dụng cho dịch vụ công nghệ thông tin bán trên website https://nanoai.vn, tại Việt Nam.',
          'Trang này là trang đổi trả riêng. Khách đọc được mà không cần đăng nhập, đăng ký hay cung cấp thông tin cá nhân.',
        ],
      },
      {
        heading: '3. Thời hạn trả lại',
        paragraphs: [
          'Khách có 30 ngày để yêu cầu trả lại, tính từ ngày giao dịch vụ. Ngày giao dịch vụ là ngày thanh toán.',
          'Sau 30 ngày, NanoAI không nhận yêu cầu trả lại.',
        ],
      },
      {
        heading: '4. Dịch vụ được trả lại',
        paragraphs: [
          'Chính sách áp dụng cho cả hai trường hợp: dịch vụ khiếm khuyết và dịch vụ không khiếm khuyết.',
          'Dịch vụ khiếm khuyết là dịch vụ chưa bàn giao, lỗi kỹ thuật không khắc phục được, hoặc kết quả không đúng mô tả đã công bố lúc mua.',
          'Dịch vụ không khiếm khuyết là trường hợp khách đổi ý sau khi thanh toán, kể cả khi đã sử dụng dịch vụ.',
        ],
      },
      {
        heading: '5. Phương thức trả lại',
        paragraphs: [
          'Khách gửi yêu cầu tới support@nanoai.vn từ email tài khoản, ghi mã giao dịch.',
          'Đây là dịch vụ trực tuyến, không có hàng hóa vật lý. Khách không gửi bưu kiện, không trả tại cửa hàng và không trả tại điểm nhận hàng.',
        ],
      },
      {
        heading: '6. Phí trả hàng',
        paragraphs: [
          'Phí vận chuyển trả hàng là 0 VND. Khách không trả phí trả hàng.',
          'Phí nhập kho là 0 VND. NanoAI không trừ khoản phí nào trên số tiền hoàn.',
        ],
      },
      {
        heading: '7. Hoàn tiền',
        paragraphs: [
          'NanoAI hoàn toàn bộ số tiền đã thanh toán cho dịch vụ được chấp nhận trả lại.',
          'Tiền được hoàn về đúng phương thức thanh toán ban đầu trong 7 ngày làm việc sau khi yêu cầu được chấp nhận.',
        ],
      },
    ],
  },
  dataDeletion: {
    pageTitle: 'Xóa dữ liệu người dùng',
    metaDescription:
      'Hướng dẫn yêu cầu xóa hoặc hạn chế dữ liệu cá nhân trên NanoAI, kể cả dữ liệu liên quan đăng nhập Facebook khi áp dụng.',
    intro:
      'NanoAI tôn trọng quyền kiểm soát dữ liệu của bạn. Trang này mô tả cách gửi yêu cầu xóa hoặc hạn chế dữ liệu cá nhân theo các bước thực tế.',
    stepsTitle: 'Cách gửi yêu cầu',
    steps: [
      'Gửi email tới support@nanoai.vn từ địa chỉ đã đăng ký tài khoản NanoAI (hoặc nêu rõ email tài khoản trong nội dung). Tiêu đề gợi ý: “Yêu cầu xóa dữ liệu NanoAI”.',
      'Trong email, mô tả ngắn gọn loại dữ liệu cần xóa (ví dụ: toàn bộ tài khoản, lịch sử chat hỗ trợ, hoặc dữ liệu tích hợp cụ thể).',
      'Chúng tôi có thể yêu cầu thông tin xác minh thêm để bảo vệ tài khoản (ví dụ: mã xác nhận, tên hiển thị gắn với tài khoản).',
      'Sau khi xác minh, chúng tôi xử lý yêu cầu trong thời gian hợp lý và có thể giữ lại một phần thông tin khi pháp luật bắt buộc hoặc vì lý do hợp pháp hợp lệ (ví dụ: hóa đơn, nhật ký bảo mật tối thiểu).',
      'Nếu bạn đã kết nối Facebook Page/Messenger với workspace đối tác NanoAI: việc hủy quyền ứng dụng cũng thực hiện trong cài đặt Facebook của bạn; phần dữ liệu lưu tại NanoAI vẫn có thể yêu cầu xóa theo các bước trên.',
    ],
    outro:
      'Mọi câu hỏi khác, vui lòng dùng Chat hỗ trợ trên website (/support-chat) hoặc email support@nanoai.vn.',
  },
}

const EN = {
  privacy: {
    pageTitle: 'Privacy policy',
    metaDescription:
      'NanoAI privacy policy: what we collect, why we use data, security, and your rights.',
    lastUpdated: 'Last updated: May 15, 2026',
    sections: [
      {
        heading: '1. Scope',
        paragraphs: [
          'This policy applies to the NanoAI website and services (“Services”). By using the Services, you acknowledge how we process information.',
          'If you do not agree, please stop using the Services.',
        ],
      },
      {
        heading: '2. Data we may collect',
        paragraphs: [
          'Account details (e.g. sign-in email), content you upload when using tools (e.g. images, text), billing and credit information when applicable, and technical logs (IP, device, browser) for operations and security.',
          'We do not knowingly collect data from children under 13. If you are a parent and believe this occurred, contact us so we can delete it.',
        ],
      },
      {
        heading: '3. Purposes',
        paragraphs: [
          'To provide and improve the Services; authenticate accounts; process payments; support users; prevent abuse and fraud; comply with legal obligations.',
          'AI-generated output is automated: you are responsible for evaluating suitability before public or commercial use.',
        ],
      },
      {
        heading: '4. Legal bases and sharing',
        paragraphs: [
          'We share data with processors needed to run the Services (e.g. hosting, payments, email), under appropriate agreements.',
          'We do not sell users’ contact details or personal data.',
          'We may disclose data when required by law or to protect rights, safety, and security of users and NanoAI.',
        ],
      },
      {
        heading: '5. Security and retention',
        paragraphs: [
          'We use reasonable technical and organizational measures to protect data; no system is perfectly secure.',
          'Retention depends on processing purposes and legal requirements; when no longer needed, we delete or anonymize where feasible.',
        ],
      },
      {
        heading: '6. Your rights and contact',
        paragraphs: [
          'Depending on applicable law, you may request access, correction, deletion, restriction, objection, or portability; you may withdraw consent where allowed.',
          'Contact: support@nanoai.vn or in-app support. We respond within a reasonable time after identity verification if needed.',
        ],
      },
    ],
  },
  terms: {
    pageTitle: 'Terms of service',
    metaDescription:
      'Terms of use for NanoAI, including AI-generated content and limitation of liability.',
    lastUpdated: 'Last updated: May 15, 2026',
    sections: [
      {
        heading: '1. Acceptance',
        paragraphs: [
          'By accessing or using NanoAI, you agree to these Terms and our Privacy Policy.',
          'If you use the Services on behalf of an organization, you confirm you have authority to bind it.',
        ],
      },
      {
        heading: '2. Services',
        paragraphs: [
          'NanoAI provides AI tools on the web; specific features may have additional limits shown in the product.',
          'We may change, suspend, or discontinue parts of the Services for maintenance or other legitimate reasons and will try to give notice when impact is significant.',
        ],
      },
      {
        heading: '3. Accounts and payments',
        paragraphs: [
          'You are responsible for safeguarding your credentials and all activity under your account.',
          'Fees, credits, and payments are as described at checkout. Refunds follow the returns policy at https://nanoai.vn/chinh-sach-doi-tra: 30 days from the service delivery date (the same day as payment), for defective services and change of mind, return shipping fee 0 VND, restocking fee 0 VND, full refund to the original payment method within 7 business days.',
          'Delivery follows https://nanoai.vn/chinh-sach-giao-hang: delivery fee 0 VND, handling time 0 days, transit time 0 days, delivered on the payment date from Vietnam. Payment follows https://nanoai.vn/chinh-sach-thanh-toan: bank transfer in VND, with the full amount shown before the customer confirms.',
        ],
      },
      {
        heading: '4. AI output and your content',
        paragraphs: [
          'AI output may be incomplete or inaccurate; you are responsible for decisions you make based on it.',
          'You retain rights to content you upload to the extent permitted by law; you grant NanoAI a license to operate and improve the Services as needed.',
        ],
      },
      {
        heading: '5. Prohibited conduct',
        paragraphs: [
          'You may not use the Services for unlawful activity, to infringe others’ rights, to distribute malware, to attack systems, or to exceed fair use limits.',
        ],
      },
      {
        heading: '6. Limitation of liability',
        paragraphs: [
          'To the fullest extent permitted by law, NanoAI and its partners are not liable for indirect, incidental, consequential, or special damages.',
          'Total liability (if any) is limited to amounts you paid for the affected Services in the reasonable period relating to the claim, where consumer laws allow such a cap.',
        ],
      },
    ],
  },
  returns: {
    pageTitle: 'Returns and refunds',
    metaDescription:
      'NanoAI refunds IT services within 30 days for defects and change of mind. Return shipping fee is 0 VND.',
    lastUpdated: 'Last updated: 19 October 2026',
    sections: [
      {
        heading: '1. Summary',
        paragraphs: [
          'Return window: 30 days from the service delivery date. IT services on nanoai.vn are delivered on the payment date.',
          'NanoAI accepts returns of defective services and non-defective services, including change of mind.',
          'Return shipping fee: 0 VND. Restocking fee: 0 VND.',
          'Full refund to the original payment method within 7 business days after the request is accepted.',
          'Return method: email support@nanoai.vn. No physical item needs to be shipped back.',
        ],
      },
      {
        heading: '2. Scope',
        paragraphs: [
          'This policy covers information-technology services sold on https://nanoai.vn for customers in Vietnam.',
          'This is a standalone returns page. Anyone can read it without signing in, registering, or submitting personal information.',
        ],
      },
      {
        heading: '3. Return window',
        paragraphs: [
          'Customers have 30 days to request a return, counted from the service delivery date. The delivery date is the payment date.',
          'After 30 days, NanoAI does not accept return requests.',
        ],
      },
      {
        heading: '4. What can be returned',
        paragraphs: [
          'The policy applies to both defective services and non-defective services.',
          'A defective service is one that was not delivered, has a technical fault we cannot fix, or does not match the description published at purchase.',
          'A non-defective service includes change of mind after payment, including after the customer has used the service.',
        ],
      },
      {
        heading: '5. Return method',
        paragraphs: [
          'Email support@nanoai.vn from the account email and include the transaction reference.',
          'These are online services with no physical goods. Customers do not mail a parcel, return in a store, or use a drop-off point.',
        ],
      },
      {
        heading: '6. Return fees',
        paragraphs: [
          'The return shipping fee is 0 VND. Returns are free for the customer.',
          'The restocking fee is 0 VND. NanoAI does not deduct any fee from the refund.',
        ],
      },
      {
        heading: '7. Refund',
        paragraphs: [
          'NanoAI refunds the full amount paid for the service that is accepted for return.',
          'The refund goes back to the original payment method within 7 business days after the request is accepted.',
        ],
      },
    ],
  },
  dataDeletion: {
    pageTitle: 'User data deletion',
    metaDescription:
      'How to request deletion or restriction of personal data on NanoAI, including data related to Facebook Login where applicable.',
    intro:
      'NanoAI respects your control over your data. This page explains how to submit a deletion or restriction request.',
    stepsTitle: 'How to submit a request',
    steps: [
      'Email support@nanoai.vn from the email address on your NanoAI account (or clearly state the account email in the message). Suggested subject: “NanoAI data deletion request”.',
      'Briefly describe what to delete (e.g. entire account, support chat history, or a specific integration dataset).',
      'We may ask for additional verification to protect your account.',
      'After verification, we process requests within a reasonable time and may retain certain records where required by law or for legitimate interests (e.g. invoices, minimal security logs).',
      'If you connected a Facebook Page with a NanoAI workspace, you can also revoke the app in Facebook settings; use the steps above for data stored on NanoAI.',
    ],
    outro: 'For other questions, use /support-chat or email support@nanoai.vn.',
  },
}

const ZH = {
  privacy: {
    pageTitle: '隐私政策',
    metaDescription: 'NanoAI 隐私政策：数据收集范围、使用目的、安全与用户权利。',
    lastUpdated: '最后更新：2026年5月15日',
    sections: [
      {
        heading: '1. 适用范围',
        paragraphs: [
          '本政策适用于 NanoAI 网站与服务（“服务”）。使用服务即表示您了解我们的信息处理方式。',
          '若不同意，请停止使用服务。',
        ],
      },
      {
        heading: '2. 我们可能收集的数据',
        paragraphs: [
          '账户信息（如登录邮箱）、您在使用工具时上传的内容（如图片、文本）、支付与额度相关信息，以及用于运营与安全的日志（IP、设备、浏览器）。',
          '我们不会故意收集 13 岁以下儿童数据。如发现此类情况，请联系我们删除。',
        ],
      },
      {
        heading: '3. 使用目的',
        paragraphs: [
          '用于提供与改进服务、账户验证、支付处理、客服支持、防范欺诈与滥用，以及履行法律义务。',
          '人工智能输出为自动生成，公开或商业使用前请自行评估。',
        ],
      },
      {
        heading: '4. 共享与法律依据',
        paragraphs: [
          '我们仅在运营所需时与处理商（如托管、支付、邮件）共享数据，并签署适当协议。',
          '我们不出售用户的联系方式或个人数据。',
          '在法律要求或为保护用户与 NanoAI 合法权益时，我们可能披露信息。',
        ],
      },
      {
        heading: '5. 安全与保存',
        paragraphs: [
          '我们采取合理的技术与组织措施保护数据，但无法保证绝对安全。',
          '保存期限取决于处理目的与法律要求；不再需要时，我们将在可行范围内删除或匿名化。',
        ],
      },
      {
        heading: '6. 您的权利与联系方式',
        paragraphs: [
          '在适用法律允许范围内，您可请求访问、更正、删除、限制处理、反对或可携性；也可在合法范围内撤回同意。',
          '请联系 support@nanoai.vn 或使用站内支持渠道。必要时我们会在合理期限内回复并完成身份核验。',
        ],
      },
    ],
  },
  terms: {
    pageTitle: '服务条款',
    metaDescription: 'NanoAI 服务条款：用户责任、人工智能内容及责任限制。',
    lastUpdated: '最后更新：2026年5月15日',
    sections: [
      {
        heading: '1. 同意条款',
        paragraphs: [
          '访问或使用 NanoAI，即表示您同意本条款与《隐私政策》。',
          '若您代表组织使用，您确认有权约束该组织。',
        ],
      },
      {
        heading: '2. 服务说明',
        paragraphs: [
          'NanoAI 通过网页提供人工智能工具；具体功能可能在界面上另有说明或限制。',
          '我们可能因维护或其他合理原因变更、暂停或终止部分服务，并在重大影响时尽量提前通知。',
        ],
      },
      {
        heading: '3. 账户与付款',
        paragraphs: [
          '您应妥善保管凭据并对账户下的活动负责。',
          '费用与额度以结算页面说明为准。退款依 https://nanoai.vn/chinh-sach-doi-tra：自服务交付日（与付款日相同）起 30 天，适用于有缺陷及反悔情形，退货运费 0 VND，重新入库费 0 VND，7 个工作日内全额退回原支付方式。',
          '交付见 https://nanoai.vn/chinh-sach-giao-hang：运费 0 VND，处理时间 0 天，运输时间 0 天，付款当日从越南交付。付款见 https://nanoai.vn/chinh-sach-thanh-toan：越南盾银行转账，确认前显示全部金额。',
        ],
      },
      {
        heading: '4. 人工智能输出与用户内容',
        paragraphs: [
          '人工智能输出可能不完整或不准确，您应对据此作出的重要决定自行负责。',
          '在法律允许范围内您保留上传内容的权利；您授予 NanoAI 为提供服务与改进产品所必需的使用许可。',
        ],
      },
      {
        heading: '5. 禁止行为',
        paragraphs: [
          '禁止将服务用于违法活动、侵害他人权益、传播恶意代码、攻击系统或超出合理使用范围。',
        ],
      },
      {
        heading: '6. 责任限制',
        paragraphs: [
          '在法律允许的最大范围内，NanoAI 及其合作伙伴不对间接、附带、后果性或惩罚性损害承担责任。',
          '若法律允许，总体责任以与争议相关的合理期间内您已支付的金额为上限。',
        ],
      },
    ],
  },
  returns: {
    pageTitle: '退换与退款政策',
    metaDescription: 'NanoAI 对有缺陷及反悔的信息技术服务在 30 天内退款。退货运费为 0 VND。',
    lastUpdated: '最近更新：2026年10月19日',
    sections: [
      {
        heading: '1. 摘要',
        paragraphs: [
          '退货期限：自服务交付日起 30 天。nanoai.vn 上的信息技术服务在付款当日交付。',
          'NanoAI 接受有缺陷服务和无缺陷服务的退回，包括客户反悔。',
          '退货运费：0 VND。重新入库费：0 VND。',
          '申请被接受后 7 个工作日内，全额退回原支付方式。',
          '退回方式：发送邮件至 support@nanoai.vn。无需寄回实物。',
        ],
      },
      {
        heading: '2. 范围',
        paragraphs: [
          '本政策适用于在 https://nanoai.vn 向越南客户销售的信息技术服务。',
          '这是独立的退换页面。无需登录、注册或提交个人信息即可阅读。',
        ],
      },
      {
        heading: '3. 退货期限',
        paragraphs: [
          '客户可自服务交付日起 30 天内申请退回。交付日即付款日。',
          '超过 30 天后，NanoAI 不再接受退回申请。',
        ],
      },
      {
        heading: '4. 可退回的服务',
        paragraphs: [
          '本政策同时适用于有缺陷服务和无缺陷服务。',
          '有缺陷指未交付、无法修复的技术故障，或结果与购买时公布的说明不符。',
          '无缺陷包括付款后反悔，以及已经使用服务后的反悔。',
        ],
      },
      {
        heading: '5. 退回方式',
        paragraphs: [
          '请用账户邮箱发送邮件至 support@nanoai.vn，并写明交易编号。',
          '本服务为在线服务，没有实物。客户无需邮寄包裹、到店退回或送到投放点。',
        ],
      },
      {
        heading: '6. 退货费用',
        paragraphs: [
          '退货运费为 0 VND。客户无需支付退货费用。',
          '重新入库费为 0 VND。NanoAI 不从退款中扣除任何费用。',
        ],
      },
      {
        heading: '7. 退款',
        paragraphs: [
          '对被接受退回的服务，NanoAI 退还已支付的全部金额。',
          '申请被接受后 7 个工作日内，退回原支付方式。',
        ],
      },
    ],
  },
  dataDeletion: {
    pageTitle: '用户数据删除说明',
    metaDescription: '如何在 NanoAI 请求删除或限制个人数据（含与 Facebook 登录相关的数据，如适用）。',
    intro: 'NanoAI 尊重您对数据的控制权。本页说明如何提交删除或限制处理请求。',
    stepsTitle: '提交方式',
    steps: [
      '请使用注册 NanoAI 账户的邮箱发送至 support@nanoai.vn（或在邮件中明确写出账户邮箱）。建议主题：“NanoAI 数据删除请求”。',
      '请简要说明需要删除的数据类型（例如：整个账户、客服聊天记录或某类集成数据）。',
      '我们可能会要求额外验证信息以保护您的账户。',
      '验证后，我们将在合理期限内处理；依法须保留的信息（如账单、最低限度安全日志）可能仍会保存。',
      '若您将 Facebook 公共主页与 NanoAI 工作区连接，也可在 Facebook 设置中撤销应用授权；仍可通过上述步骤请求删除存储在 NanoAI 侧的数据。',
    ],
    outro: '其他问题请使用站内 /support-chat 或发送邮件至 support@nanoai.vn。',
  },
}

const JA = {
  privacy: {
    pageTitle: 'プライバシーポリシー',
    metaDescription:
      'NanoAI のプライバシーポリシー：収集データ、利用目的、セキュリティ、ユーザーの権利について。',
    lastUpdated: '最終更新：2026年5月15日',
    sections: [
      {
        heading: '1. 適用範囲',
        paragraphs: [
          '本ポリシーは NanoAI のウェブサイトおよびサービス（以下「本サービス」）に適用されます。本サービスを利用することで、情報の取り扱いについて理解したものとみなします。',
          '同意できない場合は利用を中止してください。',
        ],
      },
      {
        heading: '2. 取得する可能性があるデータ',
        paragraphs: [
          'アカウント情報（ログイン用メールなど）、ツール利用時にアップロードされるコンテンツ（画像・テキスト等）、決済・クレジットに関する情報、運用・セキュリティのためのログ（IP、端末、ブラウザ情報）を取得する場合があります。',
          '13 歳未満の児童から意図的にデータを取得しません。保護者の方でお気づきの場合は削除のためご連絡ください。',
        ],
      },
      {
        heading: '3. 利用目的',
        paragraphs: [
          '本サービスの提供・改善、本人確認、決済処理、サポート、不正防止、法令遵守のために利用します。',
          'AI の出力は自動生成であり、公開・商用利用前に適否は利用者自身が判断してください。',
        ],
      },
      {
        heading: '4. 共有と法的根拠',
        paragraphs: [
          '本サービス運営に必要な範囲でホスティング、決済、メール送信などの委託先に提供し、適切な契約のもとで管理します。',
          '利用者の連絡先や個人データを販売することはありません。',
          '法令に基づく場合、または NanoAI と利用者の権利・安全を守るために必要な場合に開示することがあります。',
        ],
      },
      {
        heading: '5. セキュリティと保管',
        paragraphs: [
          '合理的な技術的・組織的措置でデータを保護しますが、完全な安全性は保証できません。',
          '保管期間は処理目的と法令に従い、不要となった場合は削除または匿名化します。',
        ],
      },
      {
        heading: '6. ユーザーの権利と問い合わせ',
        paragraphs: [
          '適用法に従い、アクセス、訂正、削除、処理の制限、異議申立て、データポータビリティなどを請求できる場合があります。同意の撤回も法令の範囲で可能です。',
          'お問い合わせ：support@nanoai.vn またはアプリ内サポート。必要に応じ本人確認のうえ合理的な期間内に対応します。',
        ],
      },
    ],
  },
  terms: {
    pageTitle: '利用規約',
    metaDescription:
      'NanoAI の利用規約：AI 生成コンテンツ、ユーザーの責任、免責事項について。',
    lastUpdated: '最終更新：2026年5月15日',
    sections: [
      {
        heading: '1. 規約への同意',
        paragraphs: [
          'NanoAI にアクセスまたは利用すると、本規約およびプライバシーポリシーに同意したものとみなします。',
          '団体を代表して利用する場合、当該団体を拘束する権限があることを保証します。',
        ],
      },
      {
        heading: '2. サービス内容',
        paragraphs: [
          'NanoAI は Web 上で AI ツールを提供します。機能ごとに画面上で追加条件や制限があることがあります。',
          'メンテナンス等により一部を変更・停止する場合があります。影響が大きいときは可能な範囲で事前通知します。',
        ],
      },
      {
        heading: '3. アカウントと決済',
        paragraphs: [
          'ログイン情報の管理とアカウント下の活動について利用者が責任を負います。',
          '手数料・クレジット・決済は購入手続き時の説明に従います。返金は https://nanoai.vn/chinh-sach-doi-tra に従います。提供日（支払日と同日）から30日以内、欠陥およびお客様都合のどちらも対象、返品送料 0 VND、再入庫手数料 0 VND、承認後7営業日以内に元の支払方法へ全額返金します。',
          '提供は https://nanoai.vn/chinh-sach-giao-hang に従います。配送料 0 VND、処理日数 0 日、輸送日数 0 日、支払日にベトナムから提供します。支払いは https://nanoai.vn/chinh-sach-thanh-toan に従います。VND の銀行振込で、確定前に全額を表示します。',
        ],
      },
      {
        heading: '4. AI の出力とユーザーコンテンツ',
        paragraphs: [
          'AI の出力は不完全または不正確な場合があります。重要な判断は利用者の責任で行ってください。',
          'アップロードしたコンテンツの権利は法律の範囲内で利用者に帰属します。サービス提供および改善に必要な範囲で NanoAI にライセンスを付与します。',
        ],
      },
      {
        heading: '5. 禁止事項',
        paragraphs: [
          '違法行為、第三者の権利侵害、マルウェアの流通、システム攻撃、利用制限の超過などは禁止します。',
        ],
      },
      {
        heading: '6. 責任の制限',
        paragraphs: [
          '法律の許す最大限において、NanoAI およびそのパートナーは間接損害、付随的損害、結果的損害について責任を負いません。',
          '責任の総額（ある場合）は、該当する事案に関連する期間においてお支払いいただいた金額を上限とすることがあります（消費者法令の強行規定が優先します）。',
        ],
      },
    ],
  },
  returns: {
    pageTitle: '返品・返金ポリシー',
    metaDescription:
      'NanoAI は不具合およびお客様都合の IT サービスを提供日から 30 日以内に返金します。返品送料は 0 VND です。',
    lastUpdated: '最終更新: 2026年10月19日',
    sections: [
      {
        heading: '1. 概要',
        paragraphs: [
          '返品期間: サービス提供日から 30 日。nanoai.vn の IT サービスは支払日に提供されます。',
          'NanoAI は不具合のあるサービスと不具合のないサービス（お客様都合を含む）の返品を受け付けます。',
          '返品送料: 0 VND。再入庫手数料: 0 VND。',
          '申請を受け付けてから 7 営業日以内に、支払った全額を元の支払方法へ返金します。',
          '返品方法: support@nanoai.vn へメール。物理的な商品の返送は不要です。',
        ],
      },
      {
        heading: '2. 対象',
        paragraphs: [
          '本ポリシーは https://nanoai.vn でベトナムのお客様に販売する IT サービスに適用します。',
          'これは独立した返品ページです。ログイン、登録、個人情報の入力なしで読めます。',
        ],
      },
      {
        heading: '3. 返品期間',
        paragraphs: [
          '返品申請はサービス提供日から 30 日以内です。提供日は支払日と同じです。',
          '30 日を過ぎた申請は受け付けません。',
        ],
      },
      {
        heading: '4. 返品できるサービス',
        paragraphs: [
          '不具合のあるサービスと、不具合のないサービスの両方に適用します。',
          '不具合とは、未提供、修復できない技術的不具合、または購入時の説明と結果が異なる場合です。',
          '不具合なしには、支払後の都合によるキャンセル、および利用開始後のキャンセルを含みます。',
        ],
      },
      {
        heading: '5. 返品方法',
        paragraphs: [
          'アカウントのメールアドレスから support@nanoai.vn へ、取引番号を記載して送信してください。',
          'オンラインの IT サービスであり、物理的な商品はありません。郵送、店舗、ドロップオフ地点への返送は不要です。',
        ],
      },
      {
        heading: '6. 返品費用',
        paragraphs: [
          '返品送料は 0 VND です。お客様の負担はありません。',
          '再入庫手数料は 0 VND です。返金額から手数料は引きません。',
        ],
      },
      {
        heading: '7. 返金',
        paragraphs: [
          '返品を受け付けたサービスについて、支払済み金額を全額返金します。',
          '申請受付後 7 営業日以内に、元の支払方法へ返金します。',
        ],
      },
    ],
  },
  dataDeletion: {
    pageTitle: 'ユーザーデータの削除',
    metaDescription:
      'NanoAI における個人データの削除・制限請求の手順。Facebook ログインに関連するデータにも適用される場合があります。',
    intro:
      'NanoAI はお客様のデータに対するコントロールを尊重します。本ページでは削除または処理制限の請求方法を説明します。',
    stepsTitle: '請求の手順',
    steps: [
      '登録メールアドレスから support@nanoai.vn へメールしてください（アドレスが異なる場合は本文にアカウントのメールを明記）。件名例：「NanoAI データ削除の依頼」。',
      '削除したいデータの種類を簡潔に記載してください（例：アカウント全体、サポートチャット履歴、特定の連携データなど）。',
      'アカウント保護のため追加の本人確認をお願いする場合があります。',
      '確認後、合理的な期間内に対応します。法令上の保持義務がある情報（請求書、最小限のセキュリティログなど）は残る場合があります。',
      'Facebook ページを NanoAI ワークスペースに接続している場合、Facebook 側でアプリ連携を解除することもできます。NanoAI 側のデータについては上記手順で削除を請求してください。',
    ],
    outro: 'その他は /support-chat または support@nanoai.vn までお問い合わせください。',
  },
}

const KO = {
  privacy: {
    pageTitle: '개인정보 처리방침',
    metaDescription:
      'NanoAI 개인정보 처리방침: 수집 항목, 이용 목적, 보안 및 이용자 권리.',
    lastUpdated: '최종 업데이트: 2026년 5월 15일',
    sections: [
      {
        heading: '1. 적용 범위',
        paragraphs: [
          '본 방침은 NanoAI 웹사이트 및 서비스(이하 “서비스”)에 적용됩니다. 서비스를 이용하면 정보 처리 방식을 이해한 것으로 봅니다.',
          '동의하지 않으면 서비스 이용을 중단해 주세요.',
        ],
      },
      {
        heading: '2. 수집할 수 있는 정보',
        paragraphs: [
          '계정 정보(로그인 이메일 등), 도구 사용 시 업로드하는 콘텐츠(이미지, 텍스트 등), 결제·크레딧 관련 정보, 운영·보안을 위한 기술 로그(IP, 기기, 브라우저)를 수집할 수 있습니다.',
          '만 13세 미만 아동의 정보를 고의로 수집하지 않습니다. 부모님이 이를 발견하시면 삭제를 위해 연락 주세요.',
        ],
      },
      {
        heading: '3. 이용 목적',
        paragraphs: [
          '서비스 제공 및 개선, 본인 확인, 결제, 고객 지원, 부정 이용 방지, 법적 의무 준수를 위해 이용합니다.',
          'AI 출력은 자동 생성이며 공개·상업적 이용 전 적합성은 이용자가 판단해야 합니다.',
        ],
      },
      {
        heading: '4. 공유 및 법적 근거',
        paragraphs: [
          '호스팅, 결제, 이메일 등 서비스 운영에 필요한 처리업체와 계약 하에 공유할 수 있습니다.',
          '이용자의 연락처나 개인정보를 판매하지 않습니다.',
          '법령에 따라 또는 이용자와 NanoAI의 권리·안전을 보호하기 위해 필요한 경우 정보를 공개할 수 있습니다.',
        ],
      },
      {
        heading: '5. 보안 및 보관',
        paragraphs: [
          '합리적인 기술·관리적 조치로 데이터를 보호하지만 절대적 보안을 보장할 수는 없습니다.',
          '보관 기간은 처리 목적과 법적 요구에 따르며 불필요 시 삭제하거나 비식별화합니다.',
        ],
      },
      {
        heading: '6. 이용자의 권리 및 문의',
        paragraphs: [
          '적용 법령에 따라 열람, 정정, 삭제, 처리 제한, 이의, 이동권 등을 요청할 수 있으며 법이 허용하는 범위에서 동의를 철회할 수 있습니다.',
          '문의: support@nanoai.vn 또는 앱 내 지원. 필요 시 본인 확인 후 합리적인 기간 내에 답변합니다.',
        ],
      },
    ],
  },
  terms: {
    pageTitle: '서비스 이용약관',
    metaDescription: 'NanoAI 이용약관: AI 생성물, 이용자 책임 및 책임 제한.',
    lastUpdated: '최종 업데이트: 2026년 5월 15일',
    sections: [
      {
        heading: '1. 약관 동의',
        paragraphs: [
          'NanoAI에 접속하거나 이용하면 본 약관 및 개인정보 처리방침에 동의한 것으로 간주됩니다.',
          '조직을 대표하여 이용하는 경우 해당 조직을 구속할 권한이 있음을 보증합니다.',
        ],
      },
      {
        heading: '2. 서비스',
        paragraphs: [
          'NanoAI는 웹에서 AI 도구를 제공하며, 기능별로 화면에 추가 조건이 있을 수 있습니다.',
          '유지보수 등으로 일부 서비스를 변경·중단할 수 있으며 중대한 영향이 있는 경우 가능한 범위에서 사전에 안내합니다.',
        ],
      },
      {
        heading: '3. 계정 및 결제',
        paragraphs: [
          '로그인 정보 보호 및 계정에서 발생하는 모든 활동에 대해 이용자가 책임을 집니다.',
          '요금·크레딧·결제는 결제 시 안내된 내용을 따릅니다. 환불은 https://nanoai.vn/chinh-sach-doi-tra 를 따릅니다. 서비스 제공일(결제일과 동일)부터 30일, 하자 및 단순 변심 모두 해당, 반품 배송비 0 VND, 재입고 수수료 0 VND, 승인 후 영업일 7일 이내 원래 결제 수단으로 전액 환불합니다.',
          '제공은 https://nanoai.vn/chinh-sach-giao-hang 를 따릅니다. 배송비 0 VND, 처리 0일, 운송 0일, 결제일에 베트남에서 제공합니다. 결제는 https://nanoai.vn/chinh-sach-thanh-toan 를 따릅니다. VND 계좌이체이며, 확인 전에 전액을 표시합니다.',
        ],
      },
      {
        heading: '4. AI 출력 및 사용자 콘텐츠',
        paragraphs: [
          'AI 결과는 부정확하거나 불완전할 수 있으며 중요한 판단은 이용자 책임입니다.',
          '업로드한 콘텐츠에 대한 권리는 법이 허용하는 범위에서 이용자에게 있습니다. 서비스 제공 및 개선에 필요한 범위에서 NanoAI에 라이선스를 부여합니다.',
        ],
      },
      {
        heading: '5. 금지 행위',
        paragraphs: [
          '불법 행위, 타인 권리 침해, 악성 코드 유포, 시스템 공격, 공정 이용 범위 초과 등은 금지됩니다.',
        ],
      },
      {
        heading: '6. 책임 제한',
        paragraphs: [
          '법이 허용하는 최대 한도 내에서 NanoAI 및 파트너는 간접·부수적·결과적 손해에 대해 책임지지 않습니다.',
          '책임이 인정되는 경우에도 총액은 관련 분쟁에 대해 일정 기간 내 지불한 금액을 상한으로 할 수 있습니다(소비자법의 강행규정이 우선합니다).',
        ],
      },
    ],
  },
  returns: {
    pageTitle: '교환·환불 정책',
    metaDescription:
      'NanoAI는 하자 및 단순 변심 IT 서비스를 제공일부터 30일 이내에 환불합니다. 반품 배송비는 0 VND입니다.',
    lastUpdated: '최종 업데이트: 2026년 10월 19일',
    sections: [
      {
        heading: '1. 요약',
        paragraphs: [
          '반품 기간: 서비스 제공일부터 30일. nanoai.vn의 IT 서비스는 결제일에 제공됩니다.',
          'NanoAI는 하자가 있는 서비스와 하자가 없는 서비스(단순 변심 포함)의 반품을 받습니다.',
          '반품 배송비: 0 VND. 재입고 수수료: 0 VND.',
          '요청이 접수된 후 영업일 7일 이내에 결제 금액 전액을 원래 결제 수단으로 환불합니다.',
          '반품 방법: support@nanoai.vn 으로 이메일. 실물을 돌려보낼 필요가 없습니다.',
        ],
      },
      {
        heading: '2. 범위',
        paragraphs: [
          '이 정책은 https://nanoai.vn 에서 베트남 고객에게 판매하는 IT 서비스에 적용됩니다.',
          '별도의 반품 페이지입니다. 로그인, 가입, 개인정보 입력 없이 읽을 수 있습니다.',
        ],
      },
      {
        heading: '3. 반품 기간',
        paragraphs: [
          '반품 요청은 서비스 제공일부터 30일 이내입니다. 제공일은 결제일과 같습니다.',
          '30일이 지난 요청은 받지 않습니다.',
        ],
      },
      {
        heading: '4. 반품할 수 있는 서비스',
        paragraphs: [
          '하자가 있는 서비스와 하자가 없는 서비스 모두에 적용됩니다.',
          '하자란 미제공, 고칠 수 없는 기술 오류, 또는 구매 당시 설명과 결과가 다른 경우입니다.',
          '하자가 없는 경우에는 결제 후 단순 변심과 사용을 시작한 뒤의 변심이 포함됩니다.',
        ],
      },
      {
        heading: '5. 반품 방법',
        paragraphs: [
          '계정 이메일로 support@nanoai.vn 에 거래 번호를 적어 보내 주세요.',
          '온라인 IT 서비스이며 실물 상품이 없습니다. 우편, 매장, 드롭오프 지점으로 보낼 필요가 없습니다.',
        ],
      },
      {
        heading: '6. 반품 비용',
        paragraphs: [
          '반품 배송비는 0 VND입니다. 고객 부담은 없습니다.',
          '재입고 수수료는 0 VND입니다. 환불액에서 수수료를 빼지 않습니다.',
        ],
      },
      {
        heading: '7. 환불',
        paragraphs: [
          '반품이 접수된 서비스에 대해 결제 금액 전액을 환불합니다.',
          '요청 접수 후 영업일 7일 이내에 원래 결제 수단으로 환불합니다.',
        ],
      },
    ],
  },
  dataDeletion: {
    pageTitle: '사용자 데이터 삭제 안내',
    metaDescription:
      'NanoAI에서 개인 데이터 삭제 또는 처리 제한을 요청하는 방법. Facebook 로그인 관련 데이터에도 해당될 수 있습니다.',
    intro:
      'NanoAI는 이용자의 데이터 통제를 존중합니다. 본 페이지는 삭제 또는 처리 제한 요청 방법을 설명합니다.',
    stepsTitle: '요청 방법',
    steps: [
      '등록한 이메일로 support@nanoai.vn 에 메일을 보내 주세요(다른 주소를 쓰는 경우 본문에 계정 이메일을 명시). 제목 예: “NanoAI 데이터 삭제 요청”.',
      '삭제할 데이터 유형을 간단히 적어 주세요(예: 전체 계정, 고객 지원 채팅 기록, 특정 연동 데이터).',
      '계정 보호를 위해 추가 본인 확인을 요청할 수 있습니다.',
      '확인 후 합리적인 기간 내 처리하며, 법적으로 보관이 필요한 정보(청구서, 최소 보안 로그 등)는 남을 수 있습니다.',
      'Facebook 페이지를 NanoAI 워크스페이스에 연결한 경우 Facebook 설정에서 앱 권한을 철회할 수도 있습니다. NanoAI에 저장된 데이터는 위 절차로 삭제를 요청하세요.',
    ],
    outro: '기타 문의는 /support-chat 또는 support@nanoai.vn 으로 연락 주세요.',
  },
}

export const LEGAL_PAGES_BY_LOCALE: Record<'vi' | 'en' | 'zh' | 'ja' | 'ko', LegalPagesBundle> = {
  vi: { ...VI, ...MERCHANT_CENTER_PAGES.vi },
  en: { ...EN, ...MERCHANT_CENTER_PAGES.en },
  zh: { ...ZH, ...MERCHANT_CENTER_PAGES.zh },
  ja: { ...JA, ...MERCHANT_CENTER_PAGES.ja },
  ko: { ...KO, ...MERCHANT_CENTER_PAGES.ko },
}
