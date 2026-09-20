const { readFileSync, existsSync } = require('fs')
const { join } = require('path')
const { Pool } = require('pg')
const Redis = require('ioredis')

const PID = '37a7cb4b-1faf-44b7-9265-76f2e8dfe248'
const SLUG = 'gudo-vn-3f93'
const APPLY = process.argv.includes('--apply')
const DEVICES = ['', '.laptop', '.tablet', '.mobile']

const B = {
  brand: 'gudo.vn',
  legal: 'Hộ Kinh Doanh gudo.vn',
  code: 'GUDOVN01',
  rep: 'Phùng Văn Hậu',
  addr: 'Xóm Buối, Thôn Vật Lại 3, Xã Vật Lại, Huyện Ba Vì, Thành phố Hà Nội',
  phone: '0968 659 836',
  tel: '0968659836',
  email: 'hotro@gudo.vn',
  emailPersonal: 'phungvanhau10101985@gmail.com',
  hours: '8h00 – 16h30, Thứ 2 – Thứ 7',
  hoursShort: '8h00 – 16h30',
  hoursNote: 'T2–T7',
  web: 'https://gudo.vn',
  facebook: 'https://facebook.com/gudo.vn',
  facebookLabel: 'facebook.com/gudo.vn',
  zalo: 'https://zalo.me/1714121106420519241',
  slogan: 'gudo.vn — hàng chất, giá tương xứng',
}
const ADS =
  'Shop tuân thủ chính sách quảng cáo của Google Merchant Center, Facebook (Meta) và TikTok khi chạy catalog, pixel và chiến dịch quảng cáo. Thông tin sản phẩm, giá, tồn kho và dữ liệu khách được xử lý phù hợp với quy định của các nền tảng này.'

function loadEnv(dir) {
  for (const f of ['.env.local', '.env']) {
    const p = join(dir, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (!process.env[k]) process.env[k] = v
    }
  }
}
function parseFiles(raw) {
  if (Array.isArray(raw)) return raw
  if (raw && Array.isArray(raw.files)) return raw.files
  return []
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
function L(seg, label) {
  return '<a href="/site/' + SLUG + '/' + seg + '">' + label + '</a>'
}
function tel() {
  return '<a href="tel:' + B.tel + '">' + B.phone + '</a>'
}
function mail() {
  return '<a href="mailto:' + B.email + '">' + B.email + '</a>'
}
function mailPersonal() {
  return '<a href="mailto:' + B.emailPersonal + '">' + B.emailPersonal + '</a>'
}
function fb() {
  return '<a href="' + B.facebook + '" rel="noopener noreferrer">' + B.facebookLabel + '</a>'
}
function zalo() {
  return '<a href="' + B.zalo + '" rel="noopener noreferrer">' + B.zalo + '</a>'
}
function bankBoxes() {
  return (
    '<h2>Các phương thức thanh toán</h2>' +
    '<p>Sau khi đặt hàng trên website và được xác nhận, quý khách có thể đặt cọc hoặc thanh toán bằng bất kỳ tài khoản ngân hàng nào thông qua Internet Banking, hoặc quét QR SePay trên trang đặt cọc. Số tài khoản chính thức không đổi:</p>' +
    '<ul>' +
    '<li><strong>Vietcombank</strong> — Tên TK: PHÙNG VĂN HẬU — STK: 0451000289239 — Chi nhánh Hà Nội</li>' +
    '<li><strong>Vietinbank</strong> — Tên TK: PHÙNG VĂN HẬU — STK: 107000958284 — CN TÂY HÀ NỘI - HỘI SỞ</li>' +
    '<li><strong>Agribank</strong> — Tên TK: PHÙNG VĂN HẬU — STK: 3100205578049 — Từ Liêm</li>' +
    '</ul>' +
    '<p>Khi chuyển khoản, ghi rõ số điện thoại / mã tham chiếu trên trang cọc. Không dùng STK gửi qua tin nhắn lạ ngoài website.</p>'
  )
}
function legalBox(extraLinks) {
  return (
    '<p><strong>Thông tin đơn vị sở hữu website gudo.vn</strong></p>' +
    '<p>Website <strong>gudo.vn</strong> thuộc quyền sở hữu và quản lý của <strong>' +
    B.legal +
    '</strong>.</p>' +
    '<p><strong>Giấy chứng nhận đăng ký hộ kinh doanh:</strong> ' +
    B.code +
    '</p>' +
    '<p><strong>Người đại diện:</strong> ' +
    B.rep +
    ' — Chủ hộ kinh doanh.</p>' +
    '<p><strong>Địa chỉ:</strong> ' +
    B.addr +
    '</p>' +
    '<p><strong>Điện thoại:</strong> ' +
    tel() +
    ' (Giờ làm việc: ' +
    B.hoursShort +
    ') · <strong>Email:</strong> ' +
    mail() +
    '</p>' +
    '<p>Quý khách vui lòng liên hệ trước khi đến làm việc, hoặc dùng Chat mua trên website để được hỗ trợ nhanh.</p>' +
    '<p>' +
    ADS +
    '</p>' +
    (extraLinks ? '<p>Xem thêm ' + extraLinks + '.</p>' : '')
  )
}

const PAGES = {
  privacy: {
    title: 'Chính sách bảo mật',
    crumb: 'Bảo mật',
    seo: 'Chính sách bảo mật email, số điện thoại và dữ liệu khách hàng tại gudo.vn.',
    visualKey: 'privacy',
    cms: 'privacy',
    body:
      '<p>Chính sách bảo mật email, số điện thoại và dữ liệu khách hàng – gudo.vn</p>' +
      '<h2>1. Mục đích thu thập thông tin</h2>' +
      '<p><strong>gudo.vn</strong> thu thập họ tên, email, số điện thoại, địa chỉ giao hàng và lịch sử đơn nhằm:</p>' +
      '<ul><li>Liên hệ xác nhận đơn hàng, tư vấn sản phẩm và hỗ trợ dịch vụ.</li><li>Gửi thông tin giao hàng, mã vận đơn hoặc thông báo thay đổi trạng thái đơn.</li><li>Gửi chương trình khuyến mãi hoặc thông báo quan trọng khi khách đồng ý nhận tin.</li><li>Không thu thập thông tin vượt quá phạm vi cần thiết cho thương mại điện tử hợp pháp.</li></ul>' +
      '<h2>2. Phạm vi sử dụng thông tin</h2>' +
      '<p>Thông tin được dùng trong nội bộ gudo.vn (bán hàng, CSKH, giao vận) và cung cấp cho đơn vị vận chuyển / cổng thanh toán (COD, chuyển khoản, QR SePay) trong phạm vi hoàn tất đơn.</p>' +
      '<p>Không bán, không trao đổi thông tin khách cho bên thứ ba, trừ yêu cầu hợp pháp của cơ quan nhà nước hoặc khi khách đồng ý.</p>' +
      '<h2>3. Cookie, pixel và quảng cáo</h2>' +
      '<p>Website có thể dùng cookie, pixel và thẻ đo lường của Google (Merchant Center, Ads, Analytics), Facebook/Meta và TikTok để hiển thị catalog, đo hiệu quả quảng cáo và cải thiện trải nghiệm. Khách có thể tắt cookie trên trình duyệt; một số tính năng giỏ hàng / đăng nhập vẫn cần cookie phiên. Tắt quảng cáo cá nhân hóa Google tại <a href="https://adssettings.google.com" rel="noopener noreferrer">adssettings.google.com</a>.</p>' +
      '<h2>4. Thời gian lưu trữ</h2>' +
      '<ul><li>Lưu đến khi khách yêu cầu xóa, hoặc hết thời hạn lưu chứng từ theo pháp luật kế toán / bảo vệ người tiêu dùng.</li><li>Sau đó dữ liệu được xóa hoặc ẩn danh.</li></ul>' +
      '<h2>5. Biện pháp bảo mật</h2>' +
      '<ul><li>Truyền tải HTTPS (SSL).</li><li>Giới hạn quyền truy cập nội bộ.</li><li>Không hiển thị toàn bộ số điện thoại/email ra ngoài hệ thống.</li><li>Sao lưu định kỳ, kiểm soát truy cập.</li></ul>' +
      '<h2>6. Quyền của khách hàng</h2>' +
      '<ul><li>Yêu cầu xem, sửa hoặc xóa email/SĐT đã cung cấp.</li><li>Từ chối nhận tin quảng cáo.</li><li>Khiếu nại nếu thông tin bị dùng sai mục đích.</li></ul>' +
      '<p>Gửi yêu cầu qua ' +
      L('contact', 'Thông tin liên hệ') +
      ' — hotline ' +
      tel() +
      ', email ' +
      mail() +
      ', hoặc Chat mua trên website.</p>' +
      legalBox(L('how-to-buy', 'Hướng dẫn mua hàng') + ', ' + L('returns', 'Đổi trả &amp; Hoàn tiền')),
  },
  terms: {
    title: 'Điều khoản sử dụng',
    crumb: 'Điều khoản',
    seo: 'Điều khoản sử dụng website gudo.vn – quyền, trách nhiệm và chính sách liên quan.',
    visualKey: 'terms',
    cms: 'terms',
    body:
      '<p>Điều khoản sử dụng – gudo.vn</p>' +
      '<h2>1. Giới thiệu</h2>' +
      '<p>Chào mừng quý khách đến với website <strong>gudo.vn</strong>, thuộc quyền sở hữu và quản lý của ' +
      B.legal +
      ' (mã HKD ' +
      B.code +
      ').</p>' +
      '<p>Khi truy cập và sử dụng website, quý khách đồng ý với các điều khoản dưới đây. Vui lòng đọc trước khi mua hàng.</p>' +
      '<h2>2. Quyền và trách nhiệm của khách hàng</h2>' +
      '<ul><li>Được xem, tham khảo và đặt mua sản phẩm đăng bán trên website.</li><li>Thông tin khi mua hàng phải chính xác, trung thực, đầy đủ.</li><li>Không dùng website để gian lận, phá hoại hệ thống hoặc vi phạm pháp luật Việt Nam.</li><li>Bảo mật tài khoản, mật khẩu (nếu có).</li></ul>' +
      '<h2>3. Quyền và trách nhiệm của gudo.vn</h2>' +
      '<ul><li>Có thể cập nhật hoặc tạm ngừng dịch vụ khi cần thiết.</li><li>Cam kết thông tin sản phẩm, giá, khuyến mãi minh bạch; giá trên trang là giá bán lẻ (đã gồm thuế nếu có).</li><li>Bảo mật thông tin theo ' +
      L('privacy', 'Chính sách bảo mật') +
      '.</li><li>Không chịu trách nhiệm thiệt hại do sự cố đường truyền hoặc lỗi bên thứ ba ngoài tầm kiểm soát.</li></ul>' +
      '<h2>4. Giá và thanh toán</h2>' +
      '<ul><li>Phương thức: đặt cọc (khi sản phẩm yêu cầu), COD, chuyển khoản, QR SePay.</li><li>Sản phẩm có nhãn cọc: mặc định đặt cọc <strong>30% giá trị hàng</strong> (hoặc chọn thanh toán 100%); phần còn lại và phí giao (nếu có) thanh toán khi nhận hàng.</li><li>Sai sót hiển thị giá: shop liên hệ xác nhận trước khi giao.</li></ul>' +
      '<h2>5. Giao hàng, hủy đơn và đổi trả</h2>' +
      '<ul><li>Chi tiết ' +
      L('shipping', 'Chính sách giao hàng') +
      '.</li><li>Hủy đơn trước khi gửi hàng; đổi trả / hoàn tiền theo ' +
      L('returns', 'Chính sách đổi trả, hoàn tiền và hủy đơn') +
      '.</li></ul>' +
      '<h2>6. Sở hữu trí tuệ</h2>' +
      '<ul><li>Nội dung, hình ảnh, thiết kế, logo trên gudo.vn thuộc ' +
      B.legal +
      ' hoặc được phép sử dụng để bán lẻ.</li><li>Không sao chép, phân phối trái phép nếu chưa có đồng ý bằng văn bản.</li></ul>' +
      '<h2>7. Giới hạn trách nhiệm</h2>' +
      '<p>gudo.vn không chịu trách nhiệm thiệt hại trực tiếp hoặc gián tiếp từ việc truy cập hoặc không truy cập được website, trừ khi pháp luật quy định khác.</p>' +
      '<h2>8. Luật áp dụng</h2>' +
      '<p>Điều khoản này theo pháp luật Việt Nam. Tranh chấp ưu tiên thương lượng; không thỏa thuận được thì đưa ra Tòa án có thẩm quyền tại Hà Nội.</p>' +
      '<h2>9. Liên hệ</h2>' +
      '<p><strong>' +
      B.legal +
      '</strong></p>' +
      '<ul><li>Địa chỉ: ' +
      B.addr +
      '</li><li>Điện thoại: ' +
      tel() +
      '</li><li>Email: ' +
      mail() +
      '</li><li>Website: <a href="' +
      B.web +
      '">' +
      B.web +
      '</a></li></ul>' +
      legalBox(L('contact', 'Thông tin liên hệ') + ', ' + L('how-to-buy', 'Hướng dẫn mua hàng')),
  },
  shipping: {
    title: 'Chính sách giao hàng',
    crumb: 'Vận chuyển',
    seo: 'Chính sách giao hàng toàn quốc, thời gian, phí ship và kiểm hàng tại gudo.vn.',
    visualKey: 'shipping',
    cms: 'shipping',
    body:
      '<p>Chính sách giao hàng – gudo.vn</p>' +
      '<h2>1. Phạm vi áp dụng</h2>' +
      '<p><strong>gudo.vn</strong> giao hàng <strong>toàn quốc trong Việt Nam</strong>. Không nhận đơn giao ra nước ngoài. Hợp tác đơn vị vận chuyển uy tín (GHN, Viettel Post, J&amp;T Express, EMS và đối tác khác).</p>' +
      '<p>Khách có thể COD hoặc thanh toán trước (chuyển khoản / QR SePay) theo hướng dẫn trên trang đặt cọc / đơn hàng.</p>' +
      '<h2>2. Thời gian xử lý và giao hàng</h2>' +
      '<p>Đơn được xác nhận trong <strong>24 giờ</strong> sau khi đặt thành công (và sau khi nhận cọc, nếu sản phẩm yêu cầu cọc).</p>' +
      '<p>Sản phẩm nhập và phân phối từ nhiều nguồn (Việt Nam, Trung Quốc và thị trường khác). Đơn có thể xuất từ kho nội địa hoặc kho quốc tế.</p>' +
      '<p>Giỏ mix hàng VN và hàng nhập: hệ thống tách hai mã đơn; hàng có sẵn tại Việt Nam có thể giao trước. Khách chỉ trả <strong>một lần phí giao</strong> theo tổng đã hiện khi đặt hàng.</p>' +
      '<p><strong>Thời gian dự kiến:</strong></p>' +
      '<ul><li><strong>2 – 5 ngày làm việc</strong> với hàng kho nội địa.</li><li><strong>6 – 12 ngày làm việc</strong> với hàng nhập / kho quốc tế.</li></ul>' +
      '<p>Thời gian có thể thay đổi do thời tiết, lễ, sự cố vận chuyển.</p>' +
      '<h2>3. Phí vận chuyển</h2>' +
      '<ul><li>Phí được hiển thị rõ trên giỏ hàng trước khi đặt.</li><li>Hiện tại hệ thống shop đang áp dụng <strong>miễn phí giao hàng toàn quốc</strong> (phí đồng giá 0đ). Nếu phí thay đổi, số mới sẽ hiện trên giỏ trước khi quý khách xác nhận đơn.</li></ul>' +
      '<h2>4. Kiểm tra và nhận hàng</h2>' +
      '<p>Khi nhận, vui lòng kiểm tra tình trạng, số lượng, mẫu mã trước khi ký nhận. Nếu hư hỏng, sai mẫu/size hoặc thiếu hàng: từ chối nhận và liên hệ ngay hotline ' +
      tel() +
      ' hoặc email ' +
      mail() +
      ' / ' +
      mailPersonal() +
      ' / Chat mua.</p>' +
      '<h2>5. Hàng hư hại khi vận chuyển</h2>' +
      '<p>gudo.vn phối hợp đơn vị vận chuyển xác minh và xử lý theo ' +
      L('returns', 'Chính sách Đổi trả &amp; Hoàn tiền') +
      '. Thông báo trong <strong>24 giờ</strong> kể từ lúc nhận hàng.</p>' +
      '<h2>6. Liên hệ hỗ trợ</h2>' +
      '<p><strong>' +
      B.legal +
      '</strong></p>' +
      '<ul><li>Địa chỉ: ' +
      B.addr +
      '</li><li>Hotline: ' +
      tel() +
      ' (' +
      B.hours +
      ')</li><li>Email: ' +
      mail() +
      '</li><li>Website: <a href="' +
      B.web +
      '">' +
      B.web +
      '</a></li></ul>' +
      legalBox(L('contact', 'Liên hệ') + ', ' + L('how-to-buy', 'Hướng dẫn mua hàng') + ', ' + L('privacy', 'Bảo mật')),
  },
  returns: {
    title: 'Đổi trả, hoàn tiền và hủy đơn',
    crumb: 'Đổi trả',
    seo: 'Đổi trả, hoàn tiền và hủy đơn tại gudo.vn — 7 ngày, hoàn 3–7 ngày làm việc.',
    visualKey: 'returns',
    cms: 'returns',
    body:
      '<p>Chính sách đổi trả và hoàn tiền</p>' +
      '<p>Cảm ơn quý khách đã mua tại <strong>gudo.vn</strong>. Khi đặt hàng trên website, quý khách được xem là đã đọc và đồng ý quy định dưới đây.</p>' +
      '<h2>1. Trả hàng – Hoàn tiền</h2>' +
      '<p><strong>1.1. Được trả hàng hoàn tiền</strong> khi sản phẩm lỗi kỹ thuật, hư hỏng, không đúng mô tả, sai mẫu / màu / size so với website.</p>' +
      '<p><strong>Đổi ý / không còn nhu cầu</strong> sau khi đã nhận hàng đúng mô tả: <strong>không hoàn tiền</strong>. Áp dụng mục đổi hàng (Mục 2) — đổi size 1 lần, không đổi mẫu.</p>' +
      '<p>Đã nhận đúng mô tả nhưng muốn đổi mẫu: áp dụng Mục 2 (đổi sang mẫu giá trị cao hơn, khấu trừ 40% nếu đã là size nhỏ nhất/lớn nhất).</p>' +
      '<p><strong>1.2. Thời gian hoàn tiền:</strong> sau khi shop nhận và kiểm đủ điều kiện, hoàn trong <strong>03 – 07 ngày làm việc</strong> về phương thức thanh toán ban đầu (chuyển khoản, ví/QR hoặc tiền mặt/COD).</p>' +
      '<p><strong>1.3. Chi phí:</strong> lỗi hoặc giao nhầm — gudo.vn chịu ship. Trả vì lý do cá nhân ngoài quy định — không hoàn tiền.</p>' +
      '<h2>2. Đổi hàng</h2>' +
      '<p><strong>2.1. Trường hợp được đổi</strong></p>' +
      '<ul><li>Không vừa: hỗ trợ đổi <strong>01 lần</strong> sang size khác (không đổi mẫu).</li><li>Đã là size nhỏ nhất hoặc lớn nhất, hàng không lỗi và đúng mô tả: có thể đổi sang mẫu giá trị cao hơn; shop khấu trừ <strong>40%</strong> giá trị sản phẩm ban đầu để bù chi phí xử lý.</li><li>Lỗi NSX hoặc giao nhầm: đổi miễn phí.</li><li>Không đổi nếu hư do người dùng (rách, giặt máy, phai, hư vật lý).</li></ul>' +
      '<p><strong>2.2. Điều kiện:</strong> còn tem mác, chưa dùng, chưa giặt, bao bì/phụ kiện nguyên. Trường hợp đặc biệt cần shop xác nhận trước khi gửi.</p>' +
      '<p><strong>2.3. Thời hạn:</strong> <strong>07 ngày</strong> từ ngày nhận (theo vận chuyển). Có lý do khách quan thì liên hệ trước.</p>' +
      '<p><strong>2.4. Cước đổi:</strong> không vừa — khách trả ship hai chiều (khoảng 60.000đ). Lỗi / giao nhầm — shop chịu.</p>' +
      '<h2>3. Hủy đơn hàng (trước khi gửi)</h2>' +
      '<ul>' +
      '<li><strong>Chưa xuất kho / chưa bàn giao vận chuyển:</strong> quý khách được hủy trên mục Đơn hàng, Chat mua, hotline ' +
      tel() +
      ' hoặc email ' +
      mail() +
      '. Tiền đã chuyển / đặt cọc được hoàn về phương thức ban đầu trong <strong>03 – 07 ngày làm việc</strong>.</li>' +
      '<li><strong>Đã gửi hàng:</strong> không hủy giữa đường. Nhận hàng rồi xử lý theo đổi/trả (Mục 1–2). Từ chối nhận vì lỗi / sai mô tả: shop hỗ trợ đổi hoặc hoàn.</li>' +
      '<li>Không có gói đăng ký tự gia hạn. Mọi khoản thanh toán là theo từng đơn.</li>' +
      '</ul>' +
      '<h2>4. Cách trả / gửi hàng đổi</h2>' +
      '<ol>' +
      '<li>Liên hệ Chat mua, hotline hoặc email trong <strong>07 ngày</strong> kể từ ngày nhận, nêu mã đơn và lý do.</li>' +
      '<li>Shop xác nhận điều kiện (tem mác, chưa dùng, chưa giặt).</li>' +
      '<li>Đóng gói nguyên vẹn, gửi về địa chỉ: ' +
      B.addr +
      ' (người nhận: ' +
      B.rep +
      ' / ' +
      B.legal +
      ').</li>' +
      '<li>Shop kiểm hàng rồi hoàn tiền (3–7 ngày làm việc) hoặc gửi size/mẫu đổi.</li>' +
      '</ol>' +
      '<h2>5. Liên hệ đổi / trả</h2>' +
      '<ul><li>Hotline / Chat mua: ' +
      tel() +
      '</li><li>Email: ' +
      mail() +
      ' / ' +
      mailPersonal() +
      '</li><li>Địa chỉ nhận hàng đổi/trả: ' +
      B.addr +
      '</li><li>Thời gian: ' +
      B.hours +
      '</li></ul>' +
      '<h2>6. Lưu ý</h2>' +
      '<ul><li>Shop có quyền từ chối nếu hàng không còn nguyên vẹn.</li><li>Chính sách có thể cập nhật; áp dụng đơn phát sinh từ ngày đăng mới.</li></ul>' +
      '<p>Quy định có hiệu lực từ ngày 18/09/2026.</p>' +
      legalBox(L('contact', 'Liên hệ') + ', ' + L('shipping', 'Giao hàng')),
  },
  payment: {
    title: 'Hướng dẫn thanh toán',
    crumb: 'Thanh toán',
    seo: 'Phương thức thanh toán gudo.vn: COD, chuyển khoản, QR SePay, đặt cọc 30% khi sản phẩm yêu cầu.',
    visualKey: 'payment',
    cms: 'payment',
    body:
      '<p>Hướng dẫn thanh toán – gudo.vn</p>' +
      '<h2>1. Phương thức</h2>' +
      '<ul><li><strong>COD</strong> — thanh toán khi nhận hàng (phần còn lại sau cọc, hoặc toàn bộ nếu sản phẩm không yêu cầu cọc).</li><li><strong>Chuyển khoản / QR SePay</strong> — dùng đúng STK / QR trên trang đặt cọc hoặc các số tài khoản chính thức bên dưới.</li></ul>' +
      bankBoxes() +
      '<h2>2. Đặt cọc và hủy</h2>' +
      '<p>Cọc theo <strong>từng sản phẩm</strong>, không phụ thuộc hàng Trung Quốc hay đã có tại Việt Nam. Sản phẩm có nhãn cọc: thanh toán trước mặc định <strong>30% giá trị hàng</strong> (hoặc chọn 100%). Phần còn lại và phí giao (nếu có) thu khi nhận hàng. Sản phẩm không cọc được xử lý ngay sau khi đặt. Hủy trước khi gửi hàng: hoàn khoản đã trả trong 3–7 ngày làm việc.</p>' +
      '<p>Khi chuyển khoản, ghi đúng nội dung tham chiếu trên trang cọc (số điện thoại hoặc mã đơn) để shop đối chiếu.</p>' +
      '<h2>3. Tiền tệ và hóa đơn</h2>' +
      '<p>Giá niêm yết bằng <strong>Việt Nam Đồng (₫)</strong>. Cần hóa đơn / giấy tờ hộ kinh doanh: liên hệ ' +
      mail() +
      ' trước khi đặt.</p>' +
      '<h2>4. An toàn</h2>' +
      '<p>Thanh toán trên kết nối HTTPS. gudo.vn không yêu cầu OTP ngân hàng / mật khẩu thẻ qua chat.</p>' +
      legalBox(L('how-to-buy', 'Hướng dẫn mua hàng') + ', ' + L('returns', 'Đổi trả')),
  },
  'how-to-buy': {
    title: 'Hướng dẫn mua hàng - Điều kiện thanh toán',
    crumb: 'Hướng dẫn mua hàng',
    seo: 'Hướng dẫn mua hàng, đặt cọc 30% theo sản phẩm và thanh toán tại gudo.vn.',
    visualKey: 'how_to_buy',
    cms: 'how-to-buy',
    body:
      '<p>Hướng dẫn mua hàng và điều kiện thanh toán</p>' +
      '<p><strong>gudo.vn</strong> cam kết sản phẩm <strong>đúng mẫu, đúng size, đúng chất lượng</strong> theo mô tả.</p>' +
      '<p>Giao không đúng cam kết hoặc lỗi sản xuất: shop <strong>gửi lại mẫu đúng</strong> hoặc <strong>hoàn tiền đã thanh toán / đặt cọc</strong>.</p>' +
      '<p>Không vừa: hỗ trợ <strong>đổi size 1 lần</strong> (không đổi mẫu), chi tiết ' +
      L('returns', 'đổi trả') +
      '.</p>' +
      '<p>Cọc theo từng sản phẩm. Hàng cần cọc: mặc định <strong>30%</strong> (hoặc 100%); phần còn lại và phí giao (nếu có) thanh toán khi nhận. Hàng không cọc xử lý ngay sau khi đặt. Hủy đơn khi chưa gửi hàng: hoàn tiền/cọc trong 3–7 ngày làm việc — ' +
      L('returns', 'đổi trả / hủy đơn') +
      '.</p>' +
      '<p>Chuyển khoản: ghi rõ số điện thoại / mã tham chiếu trên trang cọc. Shop xác nhận qua nội dung chuyển khoản và Chat mua.</p>' +
      '<p>Sau khi nhận hàng, mong quý khách đánh giá sản phẩm. Shop loại sản phẩm / nhà cung cấp có đánh giá trung bình dưới 4 sao để bảo vệ khách.</p>' +
      '<p>Với hơn 8 năm kinh nghiệm và uy tín trong lĩnh vực, cùng tinh thần cầu thị, lắng nghe ý kiến khách hàng, chúng tôi tin rằng sẽ mang lại sự hài lòng ngay cả với những khách hàng khó tính nhất.</p>' +
      '<p>Cách đặt: xem chi tiết → chọn màu / size → Thêm giỏ hoặc Mua → đăng nhập → Đặt hàng. Theo dõi tại mục Đơn hàng.</p>' +
      bankBoxes() +
      '<p>COD khi nhận hàng vẫn được hỗ trợ cho phần còn lại (sau cọc) hoặc toàn bộ nếu sản phẩm không yêu cầu cọc.</p>' +
      legalBox(L('contact', 'Liên hệ') + ', ' + L('returns', 'Đổi trả &amp; Hoàn tiền') + ', ' + L('payment', 'Thanh toán')),
  },
  'brand-origin': {
    title: 'Nguồn gốc và Thương hiệu sản phẩm',
    crumb: 'Nguồn gốc &amp; Thương hiệu',
    seo: 'Nguồn gốc hàng hóa, thương hiệu và cam kết không hàng giả tại gudo.vn.',
    visualKey: 'brand_origin',
    cms: 'brand-origin',
    body:
      '<p>Về chúng tôi &amp; chính sách minh bạch thông tin</p>' +
      '<h2>1. Giới thiệu</h2>' +
      '<p><strong>gudo.vn</strong> là website thương mại điện tử của ' +
      B.legal +
      ' (mã HKD ' +
      B.code +
      '). Chúng tôi bán lẻ / phân phối thời trang, giày dép, túi ví và phụ kiện.</p>' +
      '<h2>2. Nguồn gốc hàng hóa</h2>' +
      '<p>Hợp tác nhà sản xuất, nhà phân phối có đăng ký rõ ràng trong và ngoài nước. Sản phẩm tuyển từ Việt Nam, Trung Quốc, Thái Lan, Hàn Quốc và thị trường khác tùy dòng hàng.</p>' +
      '<p>Mỗi sản phẩm có mã SKU riêng. Mọi hàng, dù nguồn nào, được kiểm hình thức – chất liệu – hoàn thiện trước khi giao. gudo.vn chịu trách nhiệm cuối cùng về chất lượng hàng trên website.</p>' +
      '<h2>3. Thương hiệu &amp; bản quyền</h2>' +
      '<ul><li>gudo.vn là nhà bán lẻ độc lập.</li><li>Hàng có sẵn trên thị trường (marketplace inventory).</li><li>Không tuyên bố là đại diện chính thức hay được ủy quyền của thương hiệu được nhắc đến, trừ khi ghi chú cụ thể trên sản phẩm.</li></ul>' +
      '<h2>4. Cam kết</h2>' +
      '<ul><li><strong>KHÔNG</strong> kinh doanh hàng giả, hàng nhái, hàng vi phạm bản quyền.</li><li>Ảnh và mô tả phản ánh đúng hàng bán.</li><li>Xuất xứ minh bạch; cung cấp thêm khi khách yêu cầu.</li></ul>' +
      '<h2>5. Minh bạch &amp; tuân thủ</h2>' +
      '<ul><li>Luật Bảo vệ quyền lợi người tiêu dùng Việt Nam.</li><li>Quy định minh bạch thông tin thương mại của Bộ Công Thương.</li><li>Chính sách quảng cáo và chất lượng của Google Merchant Center, Facebook (Meta) và TikTok.</li></ul>' +
      '<h2>6. Trách nhiệm pháp lý</h2>' +
      '<p>Mọi giao dịch trên website do <strong>' +
      B.legal +
      '</strong> chịu trách nhiệm trước khách hàng và pháp luật.</p>' +
      '<ul><li>Chủ sở hữu: ' +
      B.legal +
      '</li><li>Mã HKD: ' +
      B.code +
      '</li><li>Người đại diện: ' +
      B.rep +
      '</li><li>Địa chỉ: ' +
      B.addr +
      '</li><li>Điện thoại: ' +
      tel() +
      '</li><li>Email: ' +
      mail() +
      '</li></ul>' +
      legalBox(L('contact', 'Liên hệ') + ', ' + L('reviews-policy', 'Chính sách đánh giá') + ', ' + L('returns', 'Đổi trả')),
  },
  'reviews-policy': {
    title: 'Chính sách quản lý đánh giá và chất lượng sản phẩm',
    crumb: 'Chính sách đánh giá',
    seo: 'Đánh giá thật từ khách đã mua, không sửa review, rà soát chất lượng tại gudo.vn.',
    visualKey: 'reviews_policy',
    cms: 'reviews-policy',
    body:
      '<p>Chính sách quản lý đánh giá và quản lý chất lượng sản phẩm – gudo.vn</p>' +
      '<h2>1. Quản lý đánh giá</h2>' +
      '<ul><li>Chỉ khách đã mua (đơn đã giao) được đánh giá sản phẩm đó. Đánh giá trên website là phản hồi gắn với đơn thật.</li><li>gudo.vn <strong>không chỉnh sửa</strong> nội dung đánh giá của khách.</li><li>Spam, sai sự thật, không liên quan đến sản phẩm có thể bị ẩn/xóa.</li><li>Phản hồi đúng thực tế — tích cực hay tiêu cực — được giữ để khách khác có góc nhìn khách quan.</li></ul>' +
      '<h2>2. Quản lý chất lượng</h2>' +
      '<ul><li>Bán đúng hình – đúng mẫu – đúng mô tả, theo ' +
      L('brand-origin', 'nguồn gốc &amp; thương hiệu') +
      '.</li><li>Hàng kém chất lượng hoặc nhiều đánh giá không tích cực sẽ được gỡ.</li></ul>' +
      '<p>Xem ' +
      L('returns', 'Đổi trả &amp; Hoàn tiền') +
      ', ' +
      L('brand-origin', 'Nguồn gốc và Thương hiệu') +
      '.</p>' +
      '<h2>3. Cập nhật và liên hệ</h2>' +
      '<p>Thắc mắc về đánh giá: email ' +
      mail() +
      ' hoặc ' +
      tel() +
      ' / Chat mua.</p>' +
      legalBox(L('contact', 'Liên hệ') + ', ' + L('trust', 'gudo.vn có uy tín?') + ', ' + L('privacy', 'Bảo mật')),
  },
  trust: {
    title: 'gudo.vn có uy tín không?',
    crumb: 'gudo.vn có uy tín?',
    seo: 'Cách tự kiểm uy tín gudo.vn: chính sách công khai, đơn theo tài khoản, Chat mua, đánh giá sau mua.',
    visualKey: 'trust',
    cms: 'trust',
    body:
      '<p>Mua online, lo lắng lớn nhất là shop có thật và có giữ lời không. Trang này giúp quý khách tự kiểm — không thay cho phán đoán của quý khách.</p>' +
      '<p><strong>— Đơn vị pháp lý và liên hệ công khai</strong></p>' +
      '<p>Website do <strong>' +
      B.legal +
      '</strong> (mã HKD ' +
      B.code +
      ') vận hành. Địa chỉ trụ sở, hotline ' +
      tel() +
      ', email ' +
      mail() +
      ' và Chat mua nằm trên ' +
      L('company', 'Thông tin đơn vị') +
      ' và ' +
      L('contact', 'Liên hệ') +
      '.</p>' +
      '<p><strong>— Chính sách đủ để chạy Google Shopping / Merchant Center</strong></p>' +
      '<p>Công khai ' +
      L('shipping', 'giao hàng') +
      ', ' +
      L('returns', 'đổi trả hoàn tiền') +
      ', ' +
      L('payment', 'thanh toán') +
      ', ' +
      L('privacy', 'bảo mật') +
      ', ' +
      L('how-to-buy', 'cách mua / cọc') +
      ', ' +
      L('brand-origin', 'nguồn gốc hàng') +
      '. Không giấu phí ship: phí hiện trên giỏ trước khi đặt.</p>' +
      '<p><strong>— Đơn gắn tài khoản, đánh giá sau mua</strong></p>' +
      '<p>Đơn nằm trong tài khoản khách trên gudo.vn. Đánh giá sản phẩm do khách đã nhận hàng gửi; shop không sửa lời khách. Hàng nhiều đánh giá kém sẽ được gỡ — ' +
      L('reviews-policy', 'chính sách đánh giá') +
      '.</p>' +
      '<p><strong>— Hỗ trợ đổi size, đổi trả có địa chỉ nhận hàng</strong></p>' +
      '<p>Điều kiện, thời hạn 07 ngày và địa chỉ nhận đổi/trả ghi tại ' +
      L('returns', 'Đổi trả &amp; Hoàn tiền') +
      '.</p>' +
      '<p>Quý khách nên đọc chính sách và vài đánh giá trước khi đặt; thắc mắc dùng Chat mua trên đúng tên miền gudo.vn.</p>' +
      legalBox(L('company', 'Thông tin đơn vị') + ', ' + L('reviews-policy', 'Đánh giá') + ', ' + L('returns', 'Đổi trả') + ', ' + L('contact', 'Liên hệ')),
  },
  company: {
    title: 'Thông tin đơn vị sở hữu website',
    crumb: 'Thông tin đơn vị',
    seo: 'Thông tin đơn vị gudo.vn — Hộ Kinh Doanh gudo.vn, mã HKD GUDOVN01.',
    visualKey: 'company',
    cms: 'company',
    body:
      '<p>Website <strong>gudo.vn</strong> thuộc quyền sở hữu và quản lý của <strong>' +
      B.legal +
      '</strong>.</p>' +
      '<h2>Giấy chứng nhận đăng ký hộ kinh doanh</h2>' +
      '<p>' +
      B.code +
      '</p>' +
      '<h2>Người đại diện</h2>' +
      '<p>' +
      B.rep +
      ' — Chủ hộ kinh doanh.</p>' +
      '<h2>Địa chỉ trụ sở</h2>' +
      '<p>' +
      B.addr +
      '</p>' +
      '<h2>Liên hệ</h2>' +
      '<ul><li>Điện thoại: ' +
      tel() +
      '</li><li>Giờ làm việc: ' +
      B.hours +
      '</li><li>Email: ' +
      mail() +
      '</li><li>Website: <a href="' +
      B.web +
      '">' +
      B.web +
      '</a></li></ul>' +
      '<p>Mọi giao dịch trên website do đơn vị này chịu trách nhiệm trước khách hàng và pháp luật. Vui lòng liên hệ trước khi đến làm việc.</p>' +
      '<p>' +
      ADS +
      '</p>',
  },
  contact: {
    title: 'Thông tin liên hệ',
    crumb: 'Liên hệ',
    seo: 'Liên hệ gudo.vn — địa chỉ Ba Vì, hotline, email, Chat mua.',
    visualKey: 'contact',
    cms: 'contact',
    keepLead: true,
    body:
      '<p>Thông tin liên hệ – gudo.vn</p>' +
      '<h2>1. Đơn vị sở hữu website</h2>' +
      '<ul><li>Tên đơn vị: ' +
      B.legal +
      '</li><li>Tên website: gudo.vn</li><li>Mã hộ kinh doanh: ' +
      B.code +
      '</li><li>Người đại diện: ' +
      B.rep +
      ' — Chủ hộ kinh doanh.</li><li>Lĩnh vực: bán lẻ thời trang, giày dép, phụ kiện qua Internet.</li></ul>' +
      '<h2>2. Liên hệ chính thức</h2>' +
      '<p><strong>Địa chỉ trụ sở:</strong><br/>' +
      B.addr +
      ', Việt Nam.</p>' +
      '<p><strong>Hotline:</strong> ' +
      tel() +
      '</p>' +
      '<p><strong>Email:</strong> ' +
      mail() +
      '</p>' +
      '<p><strong>Website:</strong> <a href="' +
      B.web +
      '">' +
      B.web +
      '</a></p>' +
      '<p><strong>Thời gian làm việc:</strong><br/>' +
      B.hours +
      '.</p>' +
      '<h2>3. Hỗ trợ khách hàng</h2>' +
      '<ul><li>Giải đáp sản phẩm, đơn hàng, giao hàng, đổi trả.</li><li>Tiếp nhận khiếu nại trong <strong>24 giờ làm việc</strong>.</li><li>Hướng dẫn bảo hành, đổi trả, hoàn tiền.</li></ul>' +
      '<p>Khách vui lòng <strong>liên hệ trước khi đến trực tiếp</strong>. Cách nhanh: Chat mua trên website.</p>' +
      '<h2>4. Kênh chính thức</h2>' +
      '<ul><li>Chat mua trên gudo.vn (nút Chat mua).</li><li>Email CSKH: ' +
      mail() +
      ' / ' +
      mailPersonal() +
      '</li><li>Hotline: ' +
      tel() +
      '</li><li>Facebook: ' +
      fb() +
      '</li><li>Zalo: ' +
      zalo() +
      '</li></ul>' +
      '<p>Không dùng số điện thoại, email hay trang mạng xã hội giả mạo danh nghĩa gudo.vn.</p>' +
      legalBox(L('company', 'Thông tin đơn vị sở hữu website')),
  },
  about: {
    title: 'Giới thiệu về chúng tôi',
    crumb: 'Về chúng tôi',
    seo: 'Giới thiệu gudo.vn: hàng chất, giá tương xứng, nguồn gốc minh bạch.',
    visualKey: 'about',
    cms: 'about',
    body:
      '<p>Giới thiệu về chúng tôi – gudo.vn</p>' +
      '<h2>1. Giới thiệu chung</h2>' +
      '<p><strong>gudo.vn</strong> là website thương mại điện tử thời trang, giày dép, túi ví và phụ kiện — slogan <strong>' +
      B.slogan +
      '</strong>.</p>' +
      '<p>Hoạt động dưới hình thức hộ kinh doanh, chịu trách nhiệm về chất lượng sản phẩm và dịch vụ bán hàng. Mục tiêu: mua sắm trực tuyến an toàn, minh bạch, tiện lợi, giá hợp lý.</p>' +
      '<h2>2. Tầm nhìn và sứ mệnh</h2>' +
      '<p><strong>Tầm nhìn:</strong> địa chỉ mua sắm thời trang online đáng tin cậy, minh bạch.</p>' +
      '<p><strong>Sứ mệnh:</strong> hàng đúng mô tả, giá tương xứng, CSKH lắng nghe phản hồi.</p>' +
      '<h2>3. Nguồn gốc và thương hiệu</h2>' +
      '<p>Hàng từ nhà máy, xưởng hoặc kho thương mại tại Việt Nam, Trung Quốc và thị trường khác. Mỗi SP có SKU. gudo.vn là nhà bán lẻ, không tuyên bố sở hữu thương hiệu quốc tế trừ khi ghi rõ.</p>' +
      '<ul><li>Không hàng giả, hàng nhái.</li><li>Ảnh / mô tả đúng thực tế.</li><li>Không đúng mô tả: đổi trả theo ' +
      L('returns', 'chính sách đổi trả') +
      '.</li></ul>' +
      '<p>Chi tiết ' +
      L('brand-origin', 'Nguồn gốc và Thương hiệu sản phẩm') +
      '.</p>' +
      '<h2>4. Chính sách khách hàng</h2>' +
      '<ul><li>Đổi trả trong 7 ngày nếu lỗi hoặc không đúng mô tả — ' +
      L('returns', 'Đổi trả') +
      '.</li><li>Giao toàn quốc; phí hiện trên giỏ (hiện miễn phí) — ' +
      L('shipping', 'Giao hàng') +
      '.</li><li>Hotline ' +
      tel() +
      ' (' +
      B.hours +
      '), email ' +
      mail() +
      ' / ' +
      mailPersonal() +
      ', Chat mua, Facebook ' +
      fb() +
      ', Zalo ' +
      zalo() +
      '.</li></ul>' +
      '<p>Phản hồi khiếu nại trong <strong>24 giờ làm việc</strong>.</p>' +
      '<h2>5. Tuân thủ</h2>' +
      '<ul><li>Luật Bảo vệ quyền lợi người tiêu dùng.</li><li>Minh bạch thông tin thương mại — Bộ Công Thương.</li><li>Chính sách quảng cáo Google Merchant Center, Facebook (Meta), TikTok.</li><li>HTTPS bảo vệ dữ liệu.</li></ul>' +
      '<h2>6. Pháp lý</h2>' +
      '<p><strong>' +
      B.legal +
      '</strong> — mã ' +
      B.code +
      '. Đại diện: ' +
      B.rep +
      '. Địa chỉ: ' +
      B.addr +
      '. ' +
      tel() +
      ' · ' +
      mail() +
      ' · <a href="' +
      B.web +
      '">' +
      B.web +
      '</a></p>' +
      legalBox(L('contact', 'Liên hệ') + ', ' + L('company', 'Thông tin đơn vị') + ', ' + L('how-to-buy', 'Hướng dẫn mua hàng')),
  },
  faq: {
    title: 'Câu hỏi thường gặp',
    crumb: 'FAQ',
    seo: 'FAQ gudo.vn: đặt hàng, cọc 30%, phí ship, đổi trả, liên hệ.',
    visualKey: 'faq',
    cms: 'faq',
    body:
      '<p>Câu hỏi thường gặp – gudo.vn</p>' +
      '<h2>Làm sao để đặt hàng?</h2>' +
      '<p>Chọn sản phẩm, màu/size, Thêm giỏ hoặc Mua, đăng nhập rồi Đặt hàng. Chi tiết ' +
      L('how-to-buy', 'Hướng dẫn mua hàng') +
      '.</p>' +
      '<h2>Có phải đặt cọc không?</h2>' +
      '<p>Tùy sản phẩm. Hàng có nhãn cọc: mặc định 30% (hoặc 100%). Hàng không cọc xử lý ngay. Số tiền hiện trên trang cọc sau khi đặt.</p>' +
      '<h2>Phí ship bao nhiêu? Bao lâu nhận hàng?</h2>' +
      '<p>Phí hiện trên giỏ; hiện shop đang miễn phí giao toàn quốc. Hàng kho VN khoảng 2–5 ngày làm việc; hàng nhập 6–12 ngày. Xem ' +
      L('shipping', 'Chính sách giao hàng') +
      '.</p>' +
      '<h2>Đổi size / trả hàng / hủy đơn?</h2>' +
      '<p>Hủy được khi đơn chưa gửi hàng — hoàn cọc/tiền đã trả trong 3–7 ngày làm việc. Đổi size 1 lần trong 7 ngày nếu còn tem, chưa dùng. Lỗi hoặc sai mô tả: đổi/trả miễn phí, hoàn 3–7 ngày. Đổi ý sau khi nhận đúng mô tả: không hoàn tiền. Xem ' +
      L('returns', 'Đổi trả, hoàn tiền và hủy đơn') +
      '.</p>' +
      '<h2>Liên hệ shop thế nào?</h2>' +
      '<p>Chat mua trên website, ' +
      tel() +
      ', ' +
      mail() +
      '. Địa chỉ: ' +
      B.addr +
      '.</p>' +
      '<p>' +
      ADS +
      '</p>',
  },
}

function replaceTaggedBlock(html, attr, inner) {
  const re = new RegExp('<(div|section|article)\\b([^>]*\\b' + attr + '\\b[^>]*)>([\\s\\S]*?)</\\1>', 'i')
  if (!re.test(html)) return html
  return html.replace(re, '<$1$2>' + inner + '</$1>')
}

function applyPage(html, page) {
  let out = String(html || '')
  out = out.replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, '<title>' + page.seo.replace(/"/g, '') + '</title>')
  out = out.replace(/<meta\b([^>]*name=["']description["'][^>]*)>/i, (full, attrs) => {
    const content = page.seo.replace(/"/g, '&quot;')
    if (/\bcontent=/i.test(attrs)) return '<meta' + attrs.replace(/\bcontent=(["'])[\s\S]*?\1/i, 'content="' + content + '"') + '>'
    return '<meta' + attrs + ' content="' + content + '">'
  })
  out = out.replace(/<(h1)\b([^>]*\bdata-pw-info-title\b[^>]*)>[\s\S]*?<\/\1>/i, '<h1$2>' + page.title + '</h1>')
  out = out.replace(
    /(<nav\b[^>]*data-pw-region=["']breadcrumb["'][\s\S]*?<span\b[^>]*data-pw-el=["']crumb["'][^>]*>)[\s\S]*?(<\/span>\s*<\/nav>)/i,
    '$1' + page.crumb + '$2'
  )
  out = replaceTaggedBlock(out, 'data-pw-info-body', page.body)
  if (!page.keepLead) out = out.replace(/<section\b[^>]*pw-lead-form[\s\S]*?<\/section>/i, '')
  if (page.cms) out = out.replace(/data-pw-article-kind=["'][^"']*["']/i, 'data-pw-article-kind="' + page.cms + '"')
  return out
}

function extractFooter(html) {
  const re = /<footer\b[^>]*>/i
  const open = re.exec(html)
  if (!open || open.index == null) return null
  const start = open.index
  const tagRe = /<footer\b[^>]*>|<\/footer\s*>/gi
  tagRe.lastIndex = start + open[0].length
  let depth = 1
  let m
  while ((m = tagRe.exec(html))) {
    if (m[0][1] === '/') {
      depth -= 1
      if (depth === 0) return { start, end: m.index + m[0].length, html: html.slice(start, m.index + m[0].length) }
    } else depth += 1
  }
  return null
}
function setTaggedP(block, key, innerHtml) {
  const re = new RegExp('<p\\b[^>]*data-pw-gudo-footer=["\']' + key + '["\'][^>]*>[\\s\\S]*?</p>', 'i')
  const next = '<p data-pw-gudo-footer="' + key + '">' + innerHtml + '</p>'
  if (re.test(block)) return block.replace(re, next)
  return block
}
function patchFooter(block) {
  let out = block
  out = setTaggedP(out, 'legal', esc(B.legal + ' · Người đại diện ' + B.rep + ' · Mã HKD ' + B.code))
  out = setTaggedP(
    out,
    'contact',
    esc(B.addr + '.') + ' Hotline ' + '<a href="tel:' + B.tel + '">' + esc(B.phone) + '</a>. Email <a href="mailto:' + B.email + '">' + esc(B.email) + '</a>.'
  )
  out = setTaggedP(out, 'hours', esc('Hỗ trợ ' + B.hoursShort + ' (' + B.hoursNote + '). Chat mua trên website.'))
  out = setTaggedP(out, 'email', '<a href="mailto:' + B.email + '">' + esc(B.email) + '</a>')
  out = out.replace(
    /(<div\b[^>]*data-pw-footer-kit=["']copyright["'][^>]*>)\s*<p>[\s\S]*?<\/p>/i,
    '$1\n    <p>' + esc('© 2026 gudo.vn · ' + B.legal + '. Bảo lưu mọi quyền.') + '</p>'
  )
  return out
}
function patchSlogans(html) {
  return String(html || '').replace(
    /<(span|p)\b([^>]*\b(?:data-pw-slogan|data-pw-el=["']slogan["'])[^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tag, attrs) => {
      let a = String(attrs)
      if (/data-pw-seed-slogan=/i.test(a)) {
        a = a.replace(/data-pw-seed-slogan=["'][^"']*["']/i, 'data-pw-seed-slogan="' + esc(B.slogan) + '"')
      } else {
        a += ' data-pw-seed-slogan="' + esc(B.slogan) + '"'
      }
      return '<' + tag + a + '>' + esc(B.slogan) + '</' + tag + '>'
    }
  )
}
function patchHtmlFooter(html) {
  const foot = extractFooter(html)
  let next = html
  if (foot) next = html.slice(0, foot.start) + patchFooter(foot.html) + html.slice(foot.end)
  return patchSlogans(next)
}

async function bumpSite(slug) {
  const url = String(process.env.REDIS_URL || '').trim()
  if (!url) {
    console.log('redis skip')
    return
  }
  const redis = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 800, commandTimeout: 800 })
  try {
    console.log('redis site ver', await redis.incr('pw:site:' + slug + ':ver'))
  } finally {
    redis.disconnect()
  }
}

async function upsertPage(pool, slug, page) {
  const existing = await pool.query(
    "select id::text from messaging_partner_static_pages where partner_id = '" + PID + "' and slug = '" + slug + "'"
  )
  const title = page.title.replace(/&amp;/g, '&')
  if (existing.rows[0]) {
    await pool.query(
      "update messaging_partner_static_pages set title=$1, content=$2, seo_title=$3, seo_description=$4, seo_index=true, is_published=true, updated_at=timezone('utc'::text, now()) where partner_id='" +
        PID +
        "' and slug=$5",
      [title, page.body, page.seo, page.seo, slug]
    )
    return 'updated'
  }
  await pool.query(
    'insert into messaging_partner_static_pages (partner_id, slug, title, content, seo_title, seo_description, seo_index, is_published) values (\'' +
      PID +
      '\',$1,$2,$3,$4,$5,true,true)',
    [slug, title, page.body, page.seo, page.seo]
  )
  return 'inserted'
}

async function main() {
  loadEnv(process.cwd())
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  try {
    const row = await pool.query("select project_files_json, theme_json from messaging_partner_websites where partner_id = '" + PID + "'")
    if (!row.rows[0]) throw new Error('website missing')
    const project = row.rows[0].project_files_json
    const files = parseFiles(project)
    const byPath = new Map(files.map((f) => [String(f.path || ''), f]))
    const cloneSrc = byPath.get('company.html') || byPath.get('contact.html')
    if (!cloneSrc) throw new Error('no clone source')
    let changed = 0
    const nextFiles = files.slice()

    for (const [fileBase, page] of Object.entries(PAGES)) {
      for (const suffix of DEVICES) {
        const path = fileBase + suffix + '.html'
        let src = byPath.get(path)
        let content
        if (src && src.content) {
          content = applyPage(src.content, page)
        } else {
          content = applyPage(cloneSrc.content, page)
          const created = { path, content }
          nextFiles.push(created)
          byPath.set(path, created)
          src = created
          console.log('created', path)
        }
        content = patchHtmlFooter(content)
        if (src.content !== content) {
          src.content = content
          changed += 1
        }
      }
    }

    for (const f of nextFiles) {
      if (!f || !/\.html$/i.test(String(f.path || ''))) continue
      const patched = patchHtmlFooter(String(f.content || ''))
      if (patched !== f.content) {
        f.content = patched
        changed += 1
      }
    }

    const theme = row.rows[0].theme_json && typeof row.rows[0].theme_json === 'object' ? Object.assign({}, row.rows[0].theme_json) : {}
    const keys = Array.isArray(theme.visualPageKeys) ? theme.visualPageKeys.slice() : []
    for (const page of Object.values(PAGES)) {
      if (page.visualKey && !keys.includes(page.visualKey)) keys.push(page.visualKey)
    }
    theme.visualPageKeys = keys
    theme.slogan = B.slogan

    const sample = byPath.get('privacy.html')
    const idx = sample ? String(sample.content).indexOf('Google Merchant') : -1
    console.log('files_touched_approx', changed)
    console.log('privacy_has_gmc', idx >= 0)
    const privacy = sample ? String(sample.content) : ''
    console.log('privacy_has_hau', privacy.includes('Phùng Văn Hậu'))
    console.log('privacy_has_khoa', privacy.includes('Trần Minh Khoa'))
    console.log('privacy_has_stk', privacy.includes('107000958284') || String((byPath.get('how-to-buy.html') || {}).content || '').includes('107000958284'))
    console.log('slogan', B.slogan)
    console.log('home_has_slogan', String((byPath.get('index.html') || {}).content || '').includes(B.slogan))
    console.log('how-to-buy_len', (byPath.get('how-to-buy.html') || {}).content ? String(byPath.get('how-to-buy.html').content).length : 0)

    if (!APPLY) {
      console.log('dry-run (pass --apply to write)')
      return
    }
    const nextProject = Array.isArray(project) ? nextFiles : Object.assign({}, project, { files: nextFiles })
    await pool.query(
      "update messaging_partner_websites set project_files_json=$1::jsonb, theme_json=$2::jsonb, updated_at=timezone('utc'::text, now()) where partner_id='" +
        PID +
        "'",
      [JSON.stringify(nextProject), JSON.stringify(theme)]
    )
    for (const [slug, page] of Object.entries(PAGES)) {
      const cmsSlug = page.cms
      console.log('cms_' + cmsSlug, await upsertPage(pool, cmsSlug, page))
    }
    await bumpSite(SLUG)
    console.log('applied policies', SLUG)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
