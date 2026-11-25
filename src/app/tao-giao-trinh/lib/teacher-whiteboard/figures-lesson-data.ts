const L = (vi: string, en: string, zh: string, ja: string, ko: string): [string, string, string, string, string] => [vi, en, zh, ja, ko]

type LessonVariant = { id: string; label: [string, string, string, string, string] }

export type LessonFigure = {
  id: string
  subject: 'math' | 'physics' | 'chemistry' | 'biology'
  w: number
  h: number
  fields: Array<'variant' | 'liquid' | 'level' | 'label' | 'equation'>
  label: [string, string, string, string, string]
  variants?: LessonVariant[]
}

const V = (id: string, vi: string, en: string, zh: string, ja: string, ko: string): LessonVariant => ({ id, label: L(vi, en, zh, ja, ko) })

export const lessonFigures: LessonFigure[] = [
  { id: 'count-set', subject: 'math', w: 420, h: 240, fields: ['variant'], label: L('Đếm và so sánh', 'Count and compare', '计数与比较', '数えて比べる', '세고 비교'), variants: [
    V('count', 'Đếm 1–10', 'Count 1–10', '数 1–10', '1～10 を数える', '1–10 세기'),
    V('compare', 'Nhiều và ít', 'More and fewer', '多和少', '多い・少ない', '많음과 적음'),
    V('position', 'Trong và ngoài', 'Inside and outside', '里面和外面', '中と外', '안과 밖'),
  ] },
  { id: 'number-line', subject: 'math', w: 460, h: 220, fields: ['variant'], label: L('Tia số', 'Number line', '数轴', '数直線', '수직선'), variants: [
    V('ten', 'Từ 0 đến 10', 'From 0 to 10', '从 0 到 10', '0 から 10', '0부터 10'),
    V('hundred', 'Từ 0 đến 100', 'From 0 to 100', '从 0 到 100', '0 から 100', '0부터 100'),
    V('fraction', 'Phân số trên tia số', 'Fractions on a number line', '数轴上的分数', '数直線上の分数', '수직선 위 분수'),
    V('decimal', 'Số thập phân trên tia số', 'Decimals on a number line', '数轴上的小数', '数直線上の小数', '수직선 위 소수'),
    V('integer', 'Số nguyên', 'Integers', '整数', '整数', '정수'),
  ] },
  { id: 'base-ten', subject: 'math', w: 420, h: 240, fields: [], label: L('Que tính theo chục', 'Bundles of ten', '十个一捆', '十の束', '열 개씩 묶기') },
  { id: 'clock', subject: 'math', w: 360, h: 320, fields: ['variant'], label: L('Đồng hồ', 'Clock', '时钟', '時計', '시계'), variants: [
    V('hour', 'Giờ đúng', 'Exact hour', '整点', 'ちょうど', '정각'),
    V('half', 'Giờ rưỡi', 'Half past', '半点', '半', '30분'),
    V('minute', 'Giờ và phút', 'Hours and minutes', '时和分', '時と分', '시와 분'),
  ] },
  { id: 'bar-model', subject: 'math', w: 440, h: 200, fields: [], label: L('Sơ đồ đoạn thẳng', 'Bar model', '线段图', '線分図', '막대 모델') },
  { id: 'fraction-disc', subject: 'math', w: 420, h: 240, fields: ['variant'], label: L('Hình phân số', 'Fraction picture', '分数图', '分数の図', '분수 그림'), variants: [
    V('bar', 'Thanh phân số', 'Fraction bar', '分数条', '分数バー', '분수 막대'),
    V('circle', 'Hình tròn phân số', 'Fraction circle', '分数圆', '分数の円', '분수 원'),
  ] },
  { id: 'measure-units', subject: 'math', w: 460, h: 220, fields: [], label: L('Đổi đơn vị đo', 'Convert units', '单位换算', '単位の換算', '단위 환산') },
  { id: 'percent-bar', subject: 'math', w: 460, h: 200, fields: [], label: L('Phần trăm', 'Percent bar', '百分条', '百分率バー', '백분율 막대') },
  { id: 'line-pair', subject: 'math', w: 420, h: 280, fields: ['variant'], label: L('Hai đường thẳng', 'A pair of lines', '两条直线', '2本の直線', '두 직선'), variants: [
    V('perpendicular', 'Vuông góc', 'Perpendicular', '垂直', '垂直', '수직'),
    V('transversal', 'Cát tuyến, góc so le và đồng vị', 'Transversal, alternate and corresponding angles', '截线、内错角与同位角', '截線、錯角と同位角', '할선, 엇각과 동위각'),
  ] },
  { id: 'bar-chart', subject: 'math', w: 420, h: 260, fields: [], label: L('Biểu đồ cột', 'Bar chart', '条形图', '棒グラフ', '막대그래프') },
  { id: 'mirror-symmetry', subject: 'math', w: 420, h: 260, fields: [], label: L('Đối xứng trục', 'Mirror symmetry', '轴对称', '線対称', '선대칭') },
  { id: 'venn', subject: 'math', w: 420, h: 260, fields: ['variant'], label: L('Biểu đồ Venn', 'Venn diagram', '文氏图', 'ベン図', '벤 다이어그램'), variants: [
    V('one', 'Một tập hợp', 'One set', '一个集合', '1つの集合', '한 집합'),
    V('two', 'Hai tập hợp', 'Two sets', '两个集合', '2つの集合', '두 집합'),
  ] },
  { id: 'congruence', subject: 'math', w: 460, h: 240, fields: ['variant'], label: L('Tam giác bằng nhau', 'Congruent triangles', '全等三角形', '合同な三角形', '합동인 삼각형'), variants: [
    V('sas', 'Cạnh-góc-cạnh', 'Side-angle-side', '边角边', '二辺夾角', '변-각-변'),
    V('asa', 'Góc-cạnh-góc', 'Angle-side-angle', '角边角', '二角夾辺', '각-변-각'),
    V('sss', 'Cạnh-cạnh-cạnh', 'Side-side-side', '边边边', '三辺', '변-변-변'),
  ] },
  { id: 'proportion', subject: 'math', w: 420, h: 240, fields: ['variant'], label: L('Tỉ lệ thuận và nghịch', 'Direct and inverse proportion', '正比例与反比例', '比例と反比例', '정비례와 반비례'), variants: [
    V('direct', 'Tỉ lệ thuận', 'Direct proportion', '正比例', '正比例', '정비례'),
    V('inverse', 'Tỉ lệ nghịch', 'Inverse proportion', '反比例', '反比例', '반비례'),
  ] },
  { id: 'algebra-tile', subject: 'math', w: 420, h: 280, fields: ['variant'], label: L('Hằng đẳng thức bằng hình', 'Algebra tiles', '面积证明恒等式', '面積で見る恒等式', '넓이로 보는 항등식'), variants: [
    V('sum', '(a + b)²', '(a + b)²', '(a + b)²', '(a + b)²', '(a + b)²'),
    V('diff', 'a² − b²', 'a² − b²', 'a² − b²', 'a² − b²', 'a² − b²'),
  ] },
  { id: 'thales', subject: 'math', w: 420, h: 280, fields: [], label: L('Định lí Thalès', 'Thales theorem', '泰勒斯定理', 'タレスの定理', '탈레스 정리') },
  { id: 'similar', subject: 'math', w: 440, h: 240, fields: [], label: L('Tam giác đồng dạng', 'Similar triangles', '相似三角形', '相似な三角形', '닮은 삼각형') },
  { id: 'pythagoras-fig', subject: 'math', w: 440, h: 300, fields: [], label: L('Pitago bằng diện tích', 'Pythagoras by area', '勾股定理面积', '三平方の面積', '피타고라스 넓이') },
  { id: 'circle-angles', subject: 'math', w: 420, h: 300, fields: ['variant'], label: L('Góc trong đường tròn', 'Angles in a circle', '圆中的角', '円の角', '원 안의 각'), variants: [
    V('chord', 'Dây cung', 'Chord', '弦', '弦', '현'),
    V('central', 'Góc ở tâm', 'Central angle', '圆心角', '中心角', '중심각'),
    V('inscribed', 'Góc nội tiếp', 'Inscribed angle', '圆周角', '円周角', '원주각'),
    V('tangent', 'Tiếp tuyến', 'Tangent', '切线', '接線', '접선'),
  ] },
  { id: 'chance', subject: 'math', w: 420, h: 260, fields: ['variant'], label: L('Xác suất cổ điển', 'Classical probability', '古典概率', '古典確率', '고전 확률'), variants: [
    V('dice', 'Xúc xắc', 'Die', '骰子', 'さいころ', '주사위'),
    V('coin', 'Đồng xu', 'Coin', '硬币', '硬貨', '동전'),
    V('tree', 'Cây xác suất', 'Probability tree', '概率树', '確率の木', '확률 나무'),
  ] },
  { id: 'vector-add', subject: 'math', w: 440, h: 280, fields: [], label: L('Cộng vectơ', 'Vector addition', '向量加法', 'ベクトルの和', '벡터의 합') },
  { id: 'half-plane', subject: 'math', w: 440, h: 280, fields: [], label: L('Miền nghiệm', 'Half-plane', '半平面', '半平面', '반평면') },
  { id: 'stats-chart', subject: 'math', w: 460, h: 280, fields: ['variant'], label: L('Thống kê và phân phối', 'Statistics and distributions', '统计与分布', '統計と分布', '통계와 분포'), variants: [
    V('histogram', 'Biểu đồ tần số', 'Histogram', '直方图', 'ヒストグラム', '히스토그램'),
    V('box', 'Biểu đồ hộp', 'Box plot', '箱线图', '箱ひげ図', '상자 그림'),
    V('binomial', 'Phân phối nhị thức', 'Binomial distribution', '二项分布', '二項分布', '이항분포'),
    V('normal', 'Phân phối chuẩn', 'Normal distribution', '正态分布', '正規分布', '정규분포'),
  ] },
  { id: 'sequence-line', subject: 'math', w: 460, h: 200, fields: ['variant'], label: L('Cấp số trên một trục', 'Sequence on a line', '数列数轴', '数列の数直線', '수열 수직선'), variants: [
    V('arith', 'Cấp số cộng', 'Arithmetic sequence', '等差数列', '等差数列', '등차수열'),
    V('geom', 'Cấp số nhân', 'Geometric sequence', '等比数列', '等比数列', '등비수열'),
  ] },
  { id: 'tangent-graph', subject: 'math', w: 440, h: 280, fields: [], label: L('Tiếp tuyến của đồ thị', 'Tangent to a graph', '曲线的切线', 'グラフの接線', '그래프의 접선') },
  { id: 'space-line-plane', subject: 'math', w: 420, h: 280, fields: ['variant'], label: L('Đường thẳng và mặt phẳng', 'Line and plane', '直线与平面', '直線と平面', '직선과 평면'), variants: [
    V('parallel', 'Song song mặt phẳng', 'Parallel to a plane', '平行于平面', '平面に平行', '평면에 평행'),
    V('cross', 'Cắt mặt phẳng', 'Intersects a plane', '与平面相交', '平面と交わる', '평면과 만남'),
    V('perp', 'Vuông góc mặt phẳng', 'Perpendicular to a plane', '垂直于平面', '平面に垂直', '평면에 수직'),
  ] },
  { id: 'cross-section', subject: 'math', w: 420, h: 280, fields: [], label: L('Thiết diện lăng trụ', 'Prism cross-section', '棱柱截面', '角柱の切り口', '각기둥 단면') },
  { id: 'asymptote', subject: 'math', w: 440, h: 280, fields: ['variant'], label: L('Tiệm cận', 'Asymptotes', '渐近线', '漸近線', '점근선'), variants: [
    V('reciprocal', 'y = 1/x', 'y = 1/x', 'y = 1/x', 'y = 1/x', 'y = 1/x'),
    V('linear', 'y = (x+1)/(x−1)', 'y = (x+1)/(x−1)', 'y = (x+1)/(x−1)', 'y = (x+1)/(x−1)', 'y = (x+1)/(x−1)'),
  ] },
  { id: 'variation-table', subject: 'math', w: 460, h: 220, fields: [], label: L('Bảng biến thiên', 'Variation table', '变号表', '増減表', '증감표') },
  { id: 'integral-area', subject: 'math', w: 440, h: 280, fields: [], label: L('Diện tích giữa hai đồ thị', 'Area between two graphs', '两曲线间的面积', '2曲線の間の面積', '두 그래프 사이 넓이') },
  { id: 'projection', subject: 'math', w: 460, h: 300, fields: [], label: L('Hình chiếu vuông góc', 'Orthographic views', '三视图', '正投影', '정투상') },
  { id: 'complex-plane', subject: 'math', w: 420, h: 300, fields: [], label: L('Mặt phẳng phức', 'Complex plane', '复平面', '複素数平面', '복소평면') },
  { id: 'slope-field', subject: 'math', w: 420, h: 300, fields: [], label: L('Trường hướng y′ = y', 'Slope field y′ = y', '方向场 y′ = y', '傾きの場 y′ = y', '기울기장 y′ = y') },
  { id: 'polar-curve', subject: 'math', w: 420, h: 300, fields: ['variant'], label: L('Tọa độ cực', 'Polar curve', '极坐标曲线', '極座標の曲線', '극좌표 곡선'), variants: [
    V('circle', 'r = a', 'r = a', 'r = a', 'r = a', 'r = a'),
    V('cardioid', 'r = a(1 + cos θ)', 'r = a(1 + cos θ)', 'r = a(1 + cos θ)', 'r = a(1 + cos θ)', 'r = a(1 + cos θ)'),
  ] },
  { id: 'measure-lab', subject: 'physics', w: 420, h: 260, fields: ['variant'], label: L('Dụng cụ đo', 'Measuring tools', '测量工具', '測定器具', '측정 도구'), variants: [
    V('thermo', 'Nhiệt kế', 'Thermometer', '温度计', '温度計', '온도계'),
    V('scale', 'Lực kế', 'Spring scale', '弹簧测力计', 'ばねばかり', '용수철 저울'),
    V('balance', 'Cân', 'Balance', '天平', 'てんびん', '양팔 저울'),
  ] },
  { id: 'states', subject: 'physics', w: 460, h: 240, fields: ['variant'], label: L('Ba thể của chất', 'Three states of matter', '物质三态', '物質の三態', '물질의 세 상태'), variants: [
    V('solid', 'Rắn', 'Solid', '固体', '固体', '고체'),
    V('liquid', 'Lỏng', 'Liquid', '液体', '液体', '액체'),
    V('gas', 'Khí', 'Gas', '气体', '気体', '기체'),
  ] },
  { id: 'shadow', subject: 'physics', w: 460, h: 240, fields: [], label: L('Ánh sáng thẳng và bóng', 'Straight light and a shadow', '光的直线传播与影子', '光の直進と影', '빛의 직진과 그림자') },
  { id: 'energy-flow', subject: 'physics', w: 460, h: 220, fields: [], label: L('Chuyển hóa năng lượng', 'Energy changes', '能量转化', 'エネルギーの移り変わり', '에너지 전환') },
  { id: 'simple-machine', subject: 'physics', w: 460, h: 260, fields: ['variant'], label: L('Đòn bẩy và ròng rọc', 'Lever and pulley', '杠杆和滑轮', 'てこと滑車', '지레와 도르래'), variants: [
    V('lever', 'Đòn bẩy', 'Lever', '杠杆', 'てこ', '지레'),
    V('pulley', 'Ròng rọc động', 'Movable pulley', '动滑轮', '動滑車', '움직도르래'),
  ] },
  { id: 'communicating', subject: 'physics', w: 420, h: 260, fields: [], label: L('Bình thông nhau', 'Communicating vessels', '连通器', '連通管', '연결된 그릇') },
  { id: 'phase-temp', subject: 'physics', w: 460, h: 260, fields: [], label: L('Nóng chảy và hóa hơi', 'Melting and boiling', '熔化和沸腾', '融解と沸騰', '융해와 기화') },
  { id: 'electromagnet', subject: 'physics', w: 460, h: 260, fields: [], label: L('Nam châm điện', 'Electromagnet', '电磁铁', '電磁石', '전자석') },
  { id: 'home-wire', subject: 'physics', w: 460, h: 240, fields: [], label: L('Mạch điện trong nhà', 'Household circuit', '家庭电路', '家庭の回路', '가정 회로') },
  { id: 'circular-motion', subject: 'physics', w: 420, h: 300, fields: [], label: L('Chuyển động tròn đều', 'Uniform circular motion', '匀速圆周运动', '等速円運動', '등속 원운동') },
  { id: 'collision', subject: 'physics', w: 480, h: 240, fields: [], label: L('Va chạm đàn hồi', 'Elastic collision', '弹性碰撞', '弾性衝突', '탄성 충돌') },
  { id: 'torque', subject: 'physics', w: 460, h: 240, fields: [], label: L('Moment lực', 'Torque', '力矩', '力のモーメント', '돌림힘') },
  { id: 'hooke', subject: 'physics', w: 460, h: 260, fields: [], label: L('Định luật Hooke', "Hooke's law", '胡克定律', 'フックの法則', '훅 법칙') },
  { id: 'sound-wave', subject: 'physics', w: 460, h: 220, fields: [], label: L('Sóng âm dọc', 'Longitudinal sound wave', '纵声波', '縦波の音波', '종파 소리') },
  { id: 'capacitor', subject: 'physics', w: 420, h: 260, fields: [], label: L('Tụ điện', 'Capacitor', '电容器', 'コンデンサー', '축전기') },
  { id: 'solenoid', subject: 'physics', w: 460, h: 240, fields: [], label: L('Từ trường ống dây', 'Solenoid field', '螺线管磁场', 'ソレノイドの磁場', '솔레노이드 자기장') },
  { id: 'induction', subject: 'physics', w: 460, h: 260, fields: [], label: L('Cảm ứng điện từ', 'Electromagnetic induction', '电磁感应', '電磁誘導', '전자기 유도') },
  { id: 'ac-circuit', subject: 'physics', w: 480, h: 280, fields: ['variant'], label: L('Dòng điện xoay chiều', 'Alternating current', '交流电', '交流', '교류'), variants: [
    V('graph', 'Đồ thị u–t và i–t', 'u–t and i–t graphs', 'u–t 与 i–t 图', 'u–t と i–t のグラフ', 'u–t와 i–t 그래프'),
    V('rlc', 'Mạch RLC nối tiếp', 'Series RLC', '串联 RLC', '直列 RLC', '직렬 RLC'),
    V('resonance', 'Cộng hưởng', 'Resonance', '共振', '共振', '공명'),
  ] },
  { id: 'nuclear', subject: 'physics', w: 480, h: 260, fields: ['variant'], label: L('Hạt nhân', 'The nucleus', '原子核', '原子核', '원자핵'), variants: [
    V('reaction', 'Phản ứng hạt nhân', 'Nuclear reaction', '核反应', '核反応', '핵반응'),
    V('fission', 'Phân hạch', 'Fission', '裂变', '核分裂', '핵분열'),
    V('defect', 'Độ hụt khối', 'Mass defect', '质量亏损', '質量欠損', '질량 결손'),
  ] },
  { id: 'thermo-path', subject: 'physics', w: 440, h: 280, fields: [], label: L('Đẳng áp, đẳng tích, đoạn nhiệt', 'Isobar, isochore, adiabat', '等压、等容、绝热', '定圧・定積・断熱', '등압·등적·단열') },
  { id: 'diode', subject: 'physics', w: 440, h: 260, fields: [], label: L('Điốt', 'Diode', '二极管', 'ダイオード', '다이오드') },
  { id: 'separate', subject: 'chemistry', w: 460, h: 260, fields: ['variant'], label: L('Tách chất', 'Separating a mixture', '分离混合物', '混合物の分離', '혼합물 분리'), variants: [
    V('evaporate', 'Cô cạn', 'Evaporation', '蒸发', '蒸発', '증발'),
    V('extract', 'Chiết', 'Solvent extraction', '萃取', '抽出', '추출'),
    V('paper', 'Sắc ký giấy', 'Paper chromatography', '纸色谱', 'ペーパークロマトグラフィー', '종이 크로마토그래피'),
  ] },
  { id: 'compound-class', subject: 'chemistry', w: 460, h: 240, fields: [], label: L('Oxit, axit, bazơ, muối', 'Oxides, acids, bases, salts', '氧化物、酸、碱、盐', '酸化物・酸・塩基・塩', '산화물·산·염기·염') },
  { id: 'ion-test', subject: 'chemistry', w: 460, h: 240, fields: [], label: L('Nhận biết ion', 'Ion tests', '离子检验', 'イオンの確認', '이온 확인') },
  { id: 'rust', subject: 'chemistry', w: 420, h: 240, fields: [], label: L('Sắt gỉ trong không khí ẩm', 'Iron rusting in moist air', '铁在潮湿空气中生锈', '湿った空気で鉄がさびる', '습한 공기에서 철이 녹슴') },
  { id: 'shells', subject: 'chemistry', w: 420, h: 280, fields: ['variant'], label: L('Lớp vỏ electron', 'Electron shells', '电子层', '電子殻', '전자 껍질'), variants: [
    V('Na', 'Natri 2, 8, 1', 'Sodium 2, 8, 1', '钠 2、8、1', 'ナトリウム 2, 8, 1', '나트륨 2, 8, 1'),
    V('Cl', 'Clo 2, 8, 7', 'Chlorine 2, 8, 7', '氯 2、8、7', '塩素 2, 8, 7', '염소 2, 8, 7'),
  ] },
  { id: 'redox', subject: 'chemistry', w: 460, h: 220, fields: [], label: L('Oxi hóa khử kẽm và đồng', 'Zinc and copper redox', '锌与铜的氧化还原', '亜鉛と銅の酸化還元', '아연과 구리의 산화환원') },
  { id: 'lechatelier', subject: 'chemistry', w: 460, h: 240, fields: [], label: L('Chuyển dịch cân bằng', 'Le Chatelier', '勒夏特列原理', 'ル・シャトリエ', '르샤틀리에') },
  { id: 'titration-curve', subject: 'chemistry', w: 440, h: 280, fields: [], label: L('Đường cong chuẩn độ', 'Titration curve', '滴定曲线', '滴定曲線', '적정 곡선') },
  { id: 'electrolysis-solution', subject: 'chemistry', w: 460, h: 260, fields: ['variant'], label: L('Điện phân dung dịch', 'Electrolysis of a solution', '电解溶液', '溶液の電気分解', '용액의 전기분해'), variants: [
    V('CuCl2', 'Điện phân CuCl₂', 'Electrolysis of CuCl₂', '电解 CuCl₂', 'CuCl₂ の電気分解', 'CuCl₂ 전기분해'),
    V('NaCl', 'Điện phân NaCl loãng', 'Electrolysis of dilute NaCl', '电解稀 NaCl', '希 NaCl の電気分解', '묽은 NaCl 전기분해'),
  ] },
  { id: 'isomer', subject: 'chemistry', w: 460, h: 240, fields: ['variant'], label: L('Đồng phân', 'Isomers', '异构体', '異性体', '이성질체'), variants: [
    V('chain', 'Đồng phân mạch C₄H₁₀', 'Chain isomers of C₄H₁₀', 'C₄H₁₀ 的碳链异构', 'C₄H₁₀ の鎖状異性体', 'C₄H₁₀ 사슬 이성질체'),
    V('function', 'Rượu và ete C₂H₆O', 'Alcohol and ether C₂H₆O', '醇和醚 C₂H₆O', 'アルコールとエーテル C₂H₆O', '알코올과 에터 C₂H₆O'),
  ] },
  { id: 'hydrocarbon', subject: 'chemistry', w: 420, h: 240, fields: ['variant'], label: L('Hiđrocacbon', 'Hydrocarbons', '烃', '炭化水素', '탄화수소'), variants: [
    V('alkane', 'Ankan', 'Alkane', '烷烃', 'アルカン', '알케인'),
    V('alkene', 'Anken', 'Alkene', '烯烃', 'アルケン', '알켄'),
    V('alkyne', 'Ankin', 'Alkyne', '炔烃', 'アルキン', '알카인'),
    V('arene', 'Benzen', 'Benzene', '苯', 'ベンゼン', '벤젠'),
  ] },
  { id: 'org-reaction', subject: 'chemistry', w: 480, h: 200, fields: ['variant'], label: L('Phản ứng hữu cơ', 'Organic reactions', '有机反应', '有機反応', '유기 반응'), variants: [
    V('sub', 'Thế clo vào metan', 'Chlorine substitutes into methane', '氯取代甲烷', 'メタンの塩素置換', '메테인 염소 치환'),
    V('add', 'Cộng brom vào eten', 'Bromine adds to ethene', '溴加成乙烯', 'エテンへの臭素付加', '에텐에 브로민 첨가'),
    V('elim', 'Tách nước từ etanol', 'Ethanol loses water', '乙醇脱水', 'エタノールの脱水', '에탄올 탈수'),
    V('poly', 'Trùng hợp eten', 'Ethene polymerises', '乙烯聚合', 'エテンの重合', '에텐 중합'),
  ] },
  { id: 'biomolecule', subject: 'chemistry', w: 460, h: 240, fields: ['variant'], label: L('Este, lipit, glucid, amino axit', 'Ester, fat, sugar, amino acid', '酯、脂、糖、氨基酸', 'エステル・脂質・糖・アミノ酸', '에스터·지질·당·아미노산'), variants: [
    V('ester', 'Este', 'Ester', '酯', 'エステル', '에스터'),
    V('fat', 'Chất béo', 'Fat', '脂肪', '脂肪', '지방'),
    V('sugar', 'Glucozơ', 'Glucose', '葡萄糖', 'グルコース', '글루코스'),
    V('amino', 'Amino axit', 'Amino acid', '氨基酸', 'アミノ酸', '아미노산'),
  ] },
  { id: 'electro-series', subject: 'chemistry', w: 420, h: 280, fields: [], label: L('Dãy điện hóa', 'Electrochemical series', '电化序', '電気化学列', '전기화학 계열') },
  { id: 'industry', subject: 'chemistry', w: 480, h: 240, fields: ['variant'], label: L('Sơ đồ công nghiệp', 'Industrial processes', '工业流程', '工業プロセス', '산업 공정'), variants: [
    V('haber', 'Tổng hợp amoniac', 'Haber process', '合成氨', 'アンモニア合成', '암모니아 합성'),
    V('contact', 'Oxi hóa lưu huỳnh đioxit', 'Contact process step', '二氧化硫氧化', '二酸化硫黄の酸化', '이산화황 산화'),
  ] },
  { id: 'kinetics-plot', subject: 'chemistry', w: 440, h: 260, fields: [], label: L('Động học bậc nhất', 'First-order kinetics', '一级动力学', '一次反応速度', '1차 반응 속도') },
  { id: 'kingdoms', subject: 'biology', w: 480, h: 240, fields: [], label: L('Năm giới sinh vật', 'Five kingdoms', '五界', '五つの界', '다섯 계') },
  { id: 'flowering-plant', subject: 'biology', w: 360, h: 320, fields: [], label: L('Cây có hoa', 'Flowering plant', '有花植物', '花の咲く植物', '꽃이 피는 식물') },
  { id: 'body-system', subject: 'biology', w: 480, h: 280, fields: ['variant'], label: L('Hệ cơ quan', 'Body systems', '器官系统', '器官系', '기관계'), variants: [
    V('digest', 'Tiêu hóa', 'Digestion', '消化', '消化', '소화'),
    V('circulation', 'Vòng tuần hoàn', 'Circulation', '血液循环', '血液の循環', '혈액 순환'),
    V('heart', 'Tim bốn ngăn', 'Four-chamber heart', '四腔心脏', '四つの部屋の心臓', '심장 네 방'),
    V('alveoli', 'Phế nang', 'Alveoli', '肺泡', '肺胞', '허파꽈리'),
    V('nephron', 'Nephron', 'Nephron', '肾单位', 'ネフロン', '네프론'),
    V('synapse', 'Xinap', 'Synapse', '突触', 'シナプス', '시냅스'),
    V('hormone', 'Tuyến nội tiết', 'Endocrine glands', '内分泌腺', '内分泌腺', '내분비샘'),
    V('immune', 'Đáp ứng miễn dịch', 'Immune response', '免疫应答', '免疫応答', '면역 반응'),
  ] },
  { id: 'photo-resp', subject: 'biology', w: 480, h: 260, fields: ['variant'], label: L('Quang hợp và hô hấp', 'Photosynthesis and respiration', '光合与呼吸', '光合成と呼吸', '광합성과 호흡'), variants: [
    V('photo', 'Phương trình quang hợp', 'Photosynthesis equation', '光合作用方程式', '光合成の式', '광합성 반응식'),
    V('resp', 'Phương trình hô hấp', 'Respiration equation', '呼吸作用方程式', '呼吸の式', '호흡 반응식'),
    V('light-dark', 'Pha sáng và pha tối', 'Light and dark reactions', '光反应与暗反应', '光反応と暗反応', '명반응과 암반응'),
    V('aerobic', 'Ba giai đoạn hô hấp hiếu khí', 'Three stages of aerobic respiration', '有氧呼吸三阶段', '好気呼吸の三段階', '산소 호흡 세 단계'),
  ] },
  { id: 'pollination', subject: 'biology', w: 420, h: 280, fields: [], label: L('Hoa và thụ phấn', 'Flower and pollination', '花与传粉', '花と受粉', '꽃과 수분') },
  { id: 'sex-chromosome', subject: 'biology', w: 420, h: 240, fields: [], label: L('Nhiễm sắc thể giới tính', 'Sex chromosomes', '性染色体', '性染色体', '성염색체') },
  { id: 'carbon-cycle', subject: 'biology', w: 460, h: 260, fields: [], label: L('Chu trình cacbon', 'Carbon cycle', '碳循环', '炭素循環', '탄소 순환') },
  { id: 'microbe', subject: 'biology', w: 460, h: 260, fields: ['variant'], label: L('Virut và vi khuẩn', 'Virus and bacterium', '病毒与细菌', 'ウイルスと細菌', '바이러스와 세균'), variants: [
    V('virus', 'Virut', 'Virus', '病毒', 'ウイルス', '바이러스'),
    V('bacteria', 'Vi khuẩn', 'Bacterium', '细菌', '細菌', '세균'),
  ] },
  { id: 'organelles', subject: 'biology', w: 460, h: 300, fields: ['variant'], label: L('Bào quan', 'Organelles', '细胞器', '細胞小器官', '세포소기관'), variants: [
    V('animal', 'Tế bào động vật', 'Animal cell', '动物细胞', '動物細胞', '동물세포'),
    V('plant', 'Tế bào thực vật', 'Plant cell', '植物细胞', '植物細胞', '식물세포'),
  ] },
  { id: 'enzyme', subject: 'biology', w: 440, h: 260, fields: ['variant'], label: L('Hoạt độ enzim', 'Enzyme activity', '酶活性', '酵素の活性', '효소 활성'), variants: [
    V('temp', 'Theo nhiệt độ', 'Against temperature', '随温度', '温度との関係', '온도에 따라'),
    V('ph', 'Theo pH', 'Against pH', '随 pH', 'pH との関係', 'pH에 따라'),
  ] },
  { id: 'transpiration', subject: 'biology', w: 420, h: 260, fields: [], label: L('Thoát hơi nước', 'Transpiration', '蒸腾作用', '蒸散', '증산') },
  { id: 'crossover', subject: 'biology', w: 460, h: 240, fields: [], label: L('Hoán vị gen', 'Crossing over', '交叉互换', '乗換え', '교차') },
  { id: 'mutation', subject: 'biology', w: 460, h: 220, fields: ['variant'], label: L('Đột biến', 'Mutation', '突变', '突然変異', '돌연변이'), variants: [
    V('gene', 'Đột biến gen', 'Gene mutation', '基因突变', '遺伝子突然変異', '유전자 돌연변이'),
    V('chromosome', 'Mất đoạn nhiễm sắc thể', 'Chromosome deletion', '染色体缺失', '染色体の欠失', '염색체 결실'),
  ] },
  { id: 'selection', subject: 'biology', w: 440, h: 240, fields: [], label: L('Chọn lọc tự nhiên', 'Natural selection', '自然选择', '自然選択', '자연선택') },
  { id: 'succession', subject: 'biology', w: 480, h: 220, fields: [], label: L('Diễn thế', 'Succession', '演替', '遷移', '천이') },
  { id: 'pcr-gel', subject: 'biology', w: 460, h: 240, fields: ['variant'], label: L('PCR và điện di', 'PCR and a gel', 'PCR 与电泳', 'PCR と電気泳動', 'PCR와 전기영동'), variants: [
    V('pcr', 'Ba bước PCR', 'Three PCR steps', 'PCR 三步', 'PCR の三段階', 'PCR 세 단계'),
    V('gel', 'Điện di', 'Gel electrophoresis', '凝胶电泳', 'ゲル電気泳動', '겔 전기영동'),
  ] },
  { id: 'ferment', subject: 'biology', w: 460, h: 260, fields: [], label: L('Lên men và nước vôi', 'Fermentation and limewater', '发酵与石灰水', '発酵と石灰水', '발효와 석회수') },
  { id: 'central-dogma', subject: 'biology', w: 480, h: 220, fields: [], label: L('Sao chép, phiên mã, dịch mã', 'Replication, transcription, translation', '复制、转录、翻译', '複製・転写・翻訳', '복제·전사·번역') },
]
