export const dynamic = 'force-static'

const LLMS_TXT_CONTENT = `# NanoAI

> Nền tảng trí tuệ nhân tạo toàn diện cung cấp các giải pháp AI thế hệ mới: thử đồ ảo trực tuyến, studio thiết kế hình ảnh & banner, tạo website & landing page tự động, thiết kế bao bì thông minh, chuyển văn bản thành giọng nói tiếng Việt tự nhiên và trợ lý học ngoại ngữ AI tương tác thời gian thực.

NanoAI (https://nanoai.vn) là hệ sinh thái AI đa năng dành cho cá nhân, nhà sáng tạo nội dung và doanh nghiệp thương mại điện tử. Nền tảng tích hợp các mô hình AI tiên tiến nhất để tối ưu hóa quy trình sáng tạo, tự động hóa bán hàng và nâng cao trải nghiệm số.

## Tính năng cốt lõi

- [Phòng thử đồ online](https://nanoai.vn/thu-do-online): Trải nghiệm thử trang phục ảo 1-5 người siêu thực, giữ nguyên phom dáng và chất liệu vải
- [Tạo web & landing page](https://nanoai.vn/dashboard/partner-website): Hệ thống tạo storefront và landing page tự động chuẩn SEO, tích hợp giỏ hàng và thanh toán
- [Studio thiết kế hình ảnh](https://nanoai.vn/studio-anh): Tạo ảnh sản phẩm chuyên nghiệp, banner thương mại điện tử và ấn phẩm marketing bằng AI
- [Thiết kế bao bì](https://nanoai.vn/thiet-ke-bao-bi): Tạo dieline bao bì hộp carton, nhãn chai lọ 2D/3D tự động theo kích thước chuẩn xác
- [Thiết kế logo](https://nanoai.vn/thiet-ke-logo): Thiết kế bộ nhận diện thương hiệu và logo chuyên nghiệp với công cụ tách nền tự động
- [Chuyển văn bản thành giọng nói (TTS)](https://nanoai.vn/text-to-speech): Tổng hợp giọng nói tiếng Việt tự nhiên, truyền cảm với đa dạng vùng miền
- [Học ngoại ngữ AI](https://nanoai.vn/hoc-tieng-anh-ai): Trợ lý AI luyện giao tiếp tiếng Anh tương tác trực tiếp với phản hồi phát âm theo thời gian thực
- [Tạo video Veo & Kling](https://nanoai.vn/tao-video-veo3): Khởi tạo video quảng cáo và hoạt họa chất lượng điện ảnh từ văn bản hoặc hình ảnh

## Tài liệu & Khám phá Agent

- [Tài liệu chi tiết đầy đủ (Full Documentation)](https://nanoai.vn/llms-full.txt): Toàn bộ tài liệu chi tiết và hướng dẫn tích hợp hệ thống NanoAI
- [Catalog Agent & WebMCP](https://nanoai.vn/.well-known/ai-catalog.json): Danh mục dịch vụ chuẩn Agentic Resource Discovery (ARD v1.0) và WebMCP cho AI Agent
- [Định nghĩa MCP Server](https://nanoai.vn/api/agent/mcp.json): Danh sách công cụ Model Context Protocol để tích hợp trực tiếp vào AI Assistant
- [Chính sách bảo mật](https://nanoai.vn/privacy): Cam kết bảo vệ quyền riêng tư và dữ liệu người dùng
- [Điều khoản dịch vụ](https://nanoai.vn/terms): Quy định sử dụng và trách nhiệm trên nền tảng NanoAI

## API & Tích hợp

- [API Chat & Agent](https://nanoai.vn/api/agent/mcp.json): Giao diện kết nối WebMCP phục vụ tác nhân AI duyệt web tự động
- [Open Catalog](https://nanoai.vn/dashboard/messaging): Quản lý kho hàng, danh mục sản phẩm và đồng bộ đa kênh
`

export function GET() {
  return new Response(LLMS_TXT_CONTENT, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
