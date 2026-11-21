import { evalMathExpr, parseMathExpr } from '../curriculum-math-expr'
import { worldToScreen } from './geometry'
import type { WhiteboardCamera } from './types'

export type FigureSubject = 'math' | 'physics' | 'chemistry' | 'biology'

export type FigureLabel = [string, string, string, string, string]

export type FigureVariant = {
  id: string
  label: FigureLabel
  sample?: string
  /** false: vẫn vẽ được nếu bảng đã có, nhưng không hiện trong menu vì trùng mục khác. */
  menu?: boolean
}

export type FigureField = 'variant' | 'liquid' | 'level' | 'label' | 'equation'

export type FigureItem = {
  id: string
  subject: FigureSubject
  label: FigureLabel
  w: number
  h: number
  variants?: FigureVariant[]
  fields: FigureField[]
  menu?: boolean
}

export type FigureParams = {
  variant: string
  liquid: string
  level: number
  label: string
  equation: string
  /** Số kéo trên sơ đồ: khoảng cách vật, góc, biên độ, công tắc. */
  tune: number[]
  /** false: đứng im tại clock. true: chạy, thời gian hiệu lực là sim − shift. */
  run: boolean
  clock: number
  shift: number
}

export const FIGURE_SUBJECTS: { id: FigureSubject; label: FigureLabel; color: string }[] = [
  { id: 'math', label: ['Toán', 'Math', '数学', '数学', '수학'], color: '#0284c7' },
  { id: 'physics', label: ['Vật lí', 'Physics', '物理', '物理', '물리'], color: '#d97706' },
  { id: 'chemistry', label: ['Hoá học', 'Chemistry', '化学', '化学', '화학'], color: '#059669' },
  { id: 'biology', label: ['Sinh học', 'Biology', '生物', '生物', '생물'], color: '#7c3aed' },
]

const L = (vi: string, en: string, zh: string, ja: string, ko: string): FigureLabel => [vi, en, zh, ja, ko]

export const FIGURE_ITEMS: FigureItem[] = [
  { id: 'math-formula', subject: 'math', w: 460, h: 168, fields: ['variant'], label: L('Công thức toán', 'Math formulas', '数学公式', '数学の公式', '수학 공식'), variants: [
    { id: 'pythagoras', label: L('Pythagore a² + b² = c²', 'Pythagoras a² + b² = c²', '勾股定理 a² + b² = c²', '三平方の定理 a² + b² = c²', '피타고라스 a² + b² = c²') },
    { id: 'square-sum', label: L('(a + b)²', '(a + b)²', '(a + b)²', '(a + b)²', '(a + b)²') },
    { id: 'square-diff', label: L('(a − b)²', '(a − b)²', '(a − b)²', '(a − b)²', '(a − b)²') },
    { id: 'diff-squares', label: L('a² − b²', 'a² − b²', 'a² − b²', 'a² − b²', 'a² − b²') },
    { id: 'cube-sum', label: L('(a + b)³', '(a + b)³', '(a + b)³', '(a + b)³', '(a + b)³') },
    { id: 'linear', label: L('Phương trình bậc nhất ax + b = 0', 'Linear equation ax + b = 0', '一次方程 ax + b = 0', '一次方程式 ax + b = 0', '일차방정식 ax + b = 0') },
    { id: 'quadratic', label: L('Phương trình bậc hai ax² + bx + c = 0', 'Quadratic ax² + bx + c = 0', '二次方程 ax² + bx + c = 0', '二次方程式 ax² + bx + c = 0', '이차방정식 ax² + bx + c = 0') },
    { id: 'vieta', label: L('Vi-ét: tổng và tích hai nghiệm', 'Vieta: sum and product of roots', '韦达：两根之和与积', '解と係数：和と積', '근과 계수: 합과 곱') },
    { id: 'identity', label: L('sin²α + cos²α = 1', 'sin²α + cos²α = 1', 'sin²α + cos²α = 1', 'sin²α + cos²α = 1', 'sin²α + cos²α = 1') },
    { id: 'sin-sum', label: L('Công thức cộng sin(α + β)', 'Angle-sum sin(α + β)', '和角公式 sin(α + β)', '加法公式 sin(α + β)', '덧셈 공식 sin(α + β)') },
    { id: 'tan', label: L('tan α = sin α / cos α', 'tan α = sin α / cos α', 'tan α = sin α / cos α', 'tan α = sin α / cos α', 'tan α = sin α / cos α') },
    { id: 'area', label: L('Diện tích hình tròn', 'Circle area', '圆面积', '円の面積', '원의 넓이') },
    { id: 'tri-area', label: L('Diện tích tam giác', 'Triangle area', '三角形面积', '三角形の面積', '삼각형 넓이') },
    { id: 'tri-sin', label: L('Diện tích tam giác (sin)', 'Triangle area (sin)', '三角形面积（正弦）', '三角形の面積（正弦）', '삼각형 넓이 (사인)') },
    { id: 'trapezoid', label: L('Diện tích hình thang', 'Trapezoid area', '梯形面积', '台形の面積', '사다리꼴 넓이') },
    { id: 'rect', label: L('Diện tích hình chữ nhật', 'Rectangle area', '矩形面积', '長方形の面積', '직사각형 넓이') },
    { id: 'sphere', label: L('Thể tích hình cầu', 'Sphere volume', '球体积', '球の体積', '구의 부피') },
    { id: 'cylinder', label: L('Thể tích hình trụ', 'Cylinder volume', '圆柱体积', '円柱の体積', '원기둥 부피') },
    { id: 'cone', label: L('Thể tích hình nón', 'Cone volume', '圆锥体积', '円錐の体積', '원뿔 부피') },
    { id: 'distance', label: L('Khoảng cách hai điểm trên mặt phẳng', 'Distance between two points', '平面上两点距离', '平面上の2点間の距離', '평면 위 두 점 사이 거리') },
    { id: 'slope', label: L('Hệ số góc của đường thẳng', 'Slope of a line', '直线的斜率', '直線の傾き', '직선의 기울기') },
    { id: 'circle-eq', label: L('Phương trình đường tròn', 'Circle equation', '圆的方程', '円の方程式', '원의 방정식') },
    { id: 'arith', label: L('Số hạng cấp số cộng uₙ', 'General term of an arithmetic sequence', '等差数列的通项', '等差数列の一般項', '등차수열의 일반항') },
    { id: 'geom', label: L('Số hạng cấp số nhân uₙ', 'General term of a geometric sequence', '等比数列的通项', '等比数列の一般項', '등비수열의 일반항') },
    { id: 'sum-arith', label: L('Tổng n số hạng đầu của cấp số cộng', 'Sum of an arithmetic sequence', '等差数列前 n 项和', '等差数列の和', '등차수열의 합') },
    { id: 'log', label: L('Logarit của một tích', 'Logarithm of a product', '积的对数', '積の対数', '곱의 로그') },
    { id: 'deriv', label: L('Đạo hàm luỹ thừa', 'Power derivative', '幂的导数', 'べきの導関数', '거듭제곱의 도함수') },
    { id: 'integral', label: L('Tích phân luỹ thừa', 'Power integral', '幂的积分', 'べきの積分', '거듭제곱의 적분') },
    { id: 'choose', label: L('Tổ hợp chập k của n phần tử', 'Combinations of n taken k', '从 n 个中取 k 个的组合', 'n 個から k 個の組合せ', 'n개 중 k개의 조합') },
    { id: 'prob', label: L('Xác suất biến cố P(A)', 'Probability of an event P(A)', '事件概率 P(A)', '事象の確率 P(A)', '사건의 확률 P(A)') },
  ] },
  { id: 'math-graph', subject: 'math', menu: false, w: 320, h: 220, fields: ['variant'], label: L('Đồ thị hàm số', 'Function graph', '函数图像', '関数のグラフ', '함수 그래프'), variants: [
    { id: 'parabola', label: L('Parabol', 'Parabola', '抛物线', '放物線', '포물선') },
    { id: 'line', label: L('Hàm bậc nhất', 'Linear', '一次函数', '一次関数', '일차함수') },
    { id: 'sine', label: L('Hàm sin', 'Sine', '正弦', 'サイン', '사인') },
  ] },
  { id: 'math-trig', subject: 'math', w: 460, h: 400, fields: [], label: L('Đường tròn lượng giác', 'Unit circle', '单位圆', '単位円', '단위원') },
  { id: 'spatial', subject: 'math', w: 420, h: 320, fields: ['variant', 'equation'], label: L('Đồ thị không gian', 'Spatial graph', '空间图像', '空間グラフ', '공간 그래프'), variants: [
    { id: 'paraboloid', label: L('Mặt paraboloid z = x² + y²', 'Paraboloid z = x² + y²', '抛物面 z = x² + y²', '放物面 z = x² + y²', '포물면 z = x² + y²'), sample: 'x^2+y^2' },
    { id: 'saddle', label: L('Mặt yên ngựa z = x² − y²', 'Saddle z = x² − y²', '马鞍面 z = x² − y²', '鞍形面 z = x² − y²', '안장면 z = x² − y²'), sample: 'x^2-y^2' },
    { id: 'ripple', label: L('Mặt sóng z = sin x cos y', 'Wave surface z = sin x cos y', '波浪面 z = sin x cos y', '波面 z = sin x cos y', '파동면 z = sin x cos y'), sample: 'sin(x)*cos(y)' },
  ] },
  { id: 'math-geometry', subject: 'math', menu: false, w: 300, h: 200, fields: ['variant'], label: L('Hình học', 'Geometry', '几何', '幾何', '기하'), variants: [
    { id: 'right', label: L('Tam giác vuông', 'Right triangle', '直角三角形', '直角三角形', '직각삼각형') },
    { id: 'tangent', label: L('Tiếp tuyến đường tròn', 'Tangent', '切线', '接線', '접선') },
  ] },
  { id: 'circuit', subject: 'physics', w: 560, h: 300, fields: ['variant'], label: L('Mạch điện', 'Electric circuit', '电路', '電気回路', '전기 회로'), variants: [
    { id: 'series', label: L('Mạch điện mắc nối tiếp', 'Series circuit', '串联电路', '直列回路', '직렬 회로') },
    { id: 'parallel', label: L('Mạch điện mắc song song', 'Parallel circuit', '并联电路', '並列回路', '병렬 회로') },
  ] },
  { id: 'force', subject: 'physics', w: 320, h: 220, fields: ['variant'], label: L('Lực trên vật', 'Forces on an object', '物体受力', '物体にはたらく力', '물체에 작용하는 힘'), variants: [
    { id: 'block', label: L('Vật trên mặt ngang', 'Block on a surface', '水平面上的物体', '水平面上の物体', '수평면 위 물체') },
    { id: 'incline', label: L('Vật trên mặt nghiêng', 'Object on an incline', '斜面上的物体', '斜面上の物体', '빗면 위 물체') },
  ] },
  { id: 'ray', subject: 'physics', w: 360, h: 220, fields: ['variant'], label: L('Thấu kính', 'Lenses', '透镜', 'レンズ', '렌즈'), variants: [
    { id: 'convex', label: L('Thấu kính hội tụ', 'Convex lens', '凸透镜', '凸レンズ', '볼록 렌즈') },
    { id: 'concave', label: L('Thấu kính phân kỳ', 'Concave lens', '凹透镜', '凹レンズ', '오목 렌즈') },
  ] },
  { id: 'phys-graph', subject: 'physics', w: 360, h: 220, fields: ['variant'], label: L('Đồ thị vận tốc, li độ, gia tốc', 'Velocity, position, acceleration graphs', '速度、位移、加速度图', '速度・位置・加速度のグラフ', '속도·위치·가속도 그래프'), variants: [
    { id: 'vt', label: L('Vận tốc theo thời gian v–t', 'Velocity against time v–t', '速度–时间 v–t', '速度と時間 v–t', '속도-시간 v–t') },
    { id: 'xt', label: L('Li độ theo thời gian x–t', 'Position against time x–t', '位置–时间 x–t', '位置と時間 x–t', '위치-시간 x–t') },
    { id: 'at', label: L('Gia tốc theo thời gian a–t', 'Acceleration against time a–t', '加速度–时间 a–t', '加速度と時間 a–t', '가속도-시간 a–t') },
  ] },
  { id: 'wave', subject: 'physics', w: 380, h: 210, fields: ['variant'], label: L('Sóng ngang và đồ thị li độ', 'Transverse wave and displacement graph', '横波与位移图', '横波と変位のグラフ', '횡파와 변위 그래프'), variants: [
    { id: 'wave', label: L('Sóng ngang', 'Transverse wave', '横波', '横波', '횡파') },
    { id: 'spring', menu: false, label: L('Con lắc lò xo', 'Spring oscillator', '弹簧振子', 'ばね振り子', '용수철 진자') },
    { id: 'osc', label: L('Li độ dao động theo thời gian x–t', 'Oscillation displacement x–t', '振动位移–时间 x–t', '振動の変位と時間 x–t', '진동 변위-시간 x–t') },
  ] },
  { id: 'field', subject: 'physics', w: 340, h: 220, fields: ['variant'], label: L('Điện trường, từ trường', 'Electric and magnetic fields', '电场与磁场', '電場と磁場', '전기장·자기장'), variants: [
    { id: 'electric', label: L('Điện trường của hai điện tích', 'Field of two charges', '两个电荷的电场', '2つの電荷の電場', '두 전하의 전기장') },
    { id: 'magnet', label: L('Từ trường của thanh nam châm', 'Field of a bar magnet', '条形磁铁的磁场', '棒磁石の磁場', '막대자석의 자기장') },
    { id: 'wire', label: L('Lực từ lên dòng điện', 'Force on a current', '电流所受磁力', '電流が受ける力', '전류가 받는 자기력') },
  ] },
  { id: 'law-graph', subject: 'physics', w: 320, h: 210, fields: ['variant'], label: L('Đồ thị phóng xạ, chất khí, quãng đường', 'Decay, gas, and distance graphs', '衰变、气体、路程图', '崩壊・気体・道のりのグラフ', '붕괴·기체·이동거리 그래프'), variants: [
    { id: 'decay', label: L('Phân rã phóng xạ theo thời gian', 'Radioactive decay over time', '放射性衰变随时间', '時間による放射性崩壊', '시간에 따른 방사성 붕괴') },
    { id: 'gas', label: L('Đẳng nhiệt chất khí p–V', 'Isotherm of a gas p–V', '气体等温线 p–V', '気体の等温線 p–V', '기체 등온선 p–V') },
    { id: 'motion', label: L('Quãng đường theo thời gian s–t', 'Distance against time s–t', '路程–时间 s–t', '道のりと時間 s–t', '이동거리-시간 s–t') },
  ] },
  { id: 'refraction', subject: 'physics', w: 320, h: 220, fields: ['variant'], label: L('Khúc xạ ánh sáng', 'Refraction of light', '光的折射', '光の屈折', '빛의 굴절'), variants: [
    { id: 'interface', label: L('Tia sáng qua mặt phân cách hai môi trường', 'Ray across a boundary', '光线经过两种介质的界面', '2つの媒質の境界面を通る光線', '두 매질 경계면을 지나는 빛') },
    { id: 'prism', label: L('Lăng kính đổi hướng tia sáng', 'Prism bending a ray', '棱镜使光线转向', 'プリズムで光線が曲がる', '프리즘이 빛을 꺾음') },
  ] },
  { id: 'interfere', subject: 'physics', w: 720, h: 460, fields: [], label: L('Giao thoa sóng nước', 'Water-wave interference', '水波干涉', '水面波の干渉', '수면파 간섭') },
  { id: 'young', subject: 'physics', w: 740, h: 480, fields: [], label: L('Giao thoa ánh sáng Young', "Young's light interference", '杨氏光的干涉', 'ヤングの光の干渉', '영의 빛 간섭') },
  { id: 'experiment-phys', subject: 'physics', w: 360, h: 240, fields: ['variant'], label: L('Ném xiên, con lắc, rơi tự do', 'Projectile, pendulum, free fall', '斜抛、单摆、自由落体', '斜方投射・振り子・自由落下', '포물선·진자·자유낙하'), variants: [
    { id: 'projectile', label: L('Ném xiên', 'Projectile', '斜抛', '斜方投射', '포물선 운동') },
    { id: 'pendulum', label: L('Con lắc đơn', 'Simple pendulum', '单摆', '単振り子', '단진자') },
    { id: 'spring', label: L('Con lắc lò xo', 'Spring oscillator', '弹簧振子', 'ばね振り子', '용수철 진자') },
    { id: 'fall', label: L('Rơi tự do', 'Free fall', '自由落体', '自由落下', '자유낙하') },
  ] },
  { id: 'constants', subject: 'physics', w: 300, h: 180, fields: [], label: L('Bảng hằng số g, c, h, e, Nₐ, R', 'Table of g, c, h, e, Nₐ, R', '常数表 g、c、h、e、Nₐ、R', '定数表 g・c・h・e・Nₐ・R', '상수표 g, c, h, e, Nₐ, R') },
  { id: 'formula-physics', subject: 'physics', w: 460, h: 168, fields: ['variant'], label: L('Công thức vật lí', 'Physics formulas', '物理公式', '物理の公式', '물리 공식'), variants: [
    { id: 'velocity', label: L('Vận tốc trung bình v = s/t', 'Average velocity v = s/t', '平均速度 v = s/t', '平均の速度 v = s/t', '평균 속도 v = s/t') },
    { id: 'accel', label: L('Gia tốc a = (v − v₀)/t', 'Acceleration a = (v − v₀)/t', '加速度 a = (v − v₀)/t', '加速度 a = (v − v₀)/t', '가속도 a = (v − v₀)/t') },
    { id: 'motion', label: L('Chuyển động biến đổi đều s = v₀t + ½at²', 'Uniform acceleration s = v₀t + ½at²', '匀变速 s = v₀t + ½at²', '等加速度 s = v₀t + ½at²', '등가속도 s = v₀t + ½at²') },
    { id: 'newton', label: L('Định luật II Newton F = ma', 'Newton II F = ma', '牛顿第二定律 F = ma', '運動の第2法則 F = ma', '뉴턴 제2법칙 F = ma') },
    { id: 'weight', label: L('Trọng lượng P = mg', 'Weight P = mg', '重力 P = mg', '重力 P = mg', '무게 P = mg') },
    { id: 'momentum', label: L('Động lượng p = mv', 'Momentum p = mv', '动量 p = mv', '運動量 p = mv', '운동량 p = mv') },
    { id: 'work', label: L('Công của lực A = Fs cos α', 'Work of a force A = Fs cos α', '力做的功 A = Fs cos α', '力の仕事 A = Fs cos α', '힘의 일 A = Fs cos α') },
    { id: 'power', label: L('Công suất P = A/t', 'Power P = A/t', '功率 P = A/t', '仕事率 P = A/t', '일률 P = A/t') },
    { id: 'kinetic', label: L('Động năng Wđ = ½mv²', 'Kinetic energy Wđ = ½mv²', '动能 Wđ = ½mv²', '運動エネルギー Wđ = ½mv²', '운동 에너지 Wđ = ½mv²') },
    { id: 'potential', label: L('Thế năng trọng trường Wt = mgh', 'Gravitational potential Wt = mgh', '重力势能 Wt = mgh', '重力による位置エネルギー Wt = mgh', '중력 퍼텐셜 에너지 Wt = mgh') },
    { id: 'friction', label: L('Lực ma sát trượt Fms = μN', 'Sliding friction Fms = μN', '滑动摩擦力 Fms = μN', '動摩擦力 Fms = μN', '운동 마찰력 Fms = μN') },
    { id: 'density', label: L('Khối lượng riêng ρ = m/V', 'Density ρ = m/V', '密度 ρ = m/V', '密度 ρ = m/V', '밀도 ρ = m/V') },
    { id: 'pressure', label: L('Áp suất p = F/S', 'Pressure p = F/S', '压强 p = F/S', '圧力 p = F/S', '압력 p = F/S') },
    { id: 'ohm', label: L('Định luật Ohm U = IR', 'Ohm U = IR', '欧姆定律 U = IR', 'オームの法則 U = IR', '옴의 법칙 U = IR') },
    { id: 'series', label: L('Điện trở mắc nối tiếp R = R₁ + R₂', 'Series resistors R = R₁ + R₂', '串联电阻 R = R₁ + R₂', '直列抵抗 R = R₁ + R₂', '직렬 저항 R = R₁ + R₂') },
    { id: 'parallel', label: L('Điện trở mắc song song 1/R = 1/R₁ + 1/R₂', 'Parallel resistors 1/R = 1/R₁ + 1/R₂', '并联电阻 1/R = 1/R₁ + 1/R₂', '並列抵抗 1/R = 1/R₁ + 1/R₂', '병렬 저항 1/R = 1/R₁ + 1/R₂') },
    { id: 'current', label: L('Cường độ dòng điện I = q/t', 'Current I = q/t', '电流 I = q/t', '電流 I = q/t', '전류 I = q/t') },
    { id: 'joule', label: L('Nhiệt toả trên điện trở Q = I²Rt', 'Heat in a resistor Q = I²Rt', '电阻放热 Q = I²Rt', '抵抗で発生する熱 Q = I²Rt', '저항에서 나는 열 Q = I²Rt') },
    { id: 'heat', label: L('Nhiệt lượng Q = mcΔt', 'Heat Q = mcΔt', '热量 Q = mcΔt', '熱量 Q = mcΔt', '열량 Q = mcΔt') },
    { id: 'wave', label: L('Vận tốc truyền sóng v = λf', 'Wave speed v = λf', '波速 v = λf', '波の速さ v = λf', '파동 속력 v = λf') },
    { id: 'frequency', label: L('Tần số và chu kỳ f = 1/T', 'Frequency and period f = 1/T', '频率与周期 f = 1/T', '周波数と周期 f = 1/T', '진동수와 주기 f = 1/T') },
    { id: 'period', label: L('Chu kỳ con lắc đơn T = 2π√(l/g)', 'Simple pendulum period T = 2π√(l/g)', '单摆周期 T = 2π√(l/g)', '単振り子の周期 T = 2π√(l/g)', '단진자 주기 T = 2π√(l/g)') },
    { id: 'lens', label: L('Công thức thấu kính 1/f = 1/d + 1/d′', 'Thin lens 1/f = 1/d + 1/d′', '薄透镜 1/f = 1/d + 1/d′', 'レンズの公式 1/f = 1/d + 1/d′', '렌즈 공식 1/f = 1/d + 1/d′') },
    { id: 'snell', label: L('Định luật khúc xạ n₁ sin i = n₂ sin r', 'Snell n₁ sin i = n₂ sin r', '折射定律 n₁ sin i = n₂ sin r', '屈折の法則 n₁ sin i = n₂ sin r', '굴절 법칙 n₁ sin i = n₂ sin r') },
    { id: 'coulomb', label: L('Định luật Coulomb F = k|q₁q₂|/r²', 'Coulomb F = k|q₁q₂|/r²', '库仑定律 F = k|q₁q₂|/r²', 'クーロンの法則 F = k|q₁q₂|/r²', '쿨롱 법칙 F = k|q₁q₂|/r²') },
    { id: 'gas', label: L('Phương trình khí lí tưởng pV = nRT', 'Ideal gas pV = nRT', '理想气体 pV = nRT', '理想気体 pV = nRT', '이상 기체 pV = nRT') },
    { id: 'energy', label: L('Hệ thức Einstein E = mc²', 'Einstein E = mc²', '爱因斯坦关系 E = mc²', 'アインシュタインの関係 E = mc²', '아인슈타인 관계 E = mc²') },
    { id: 'efficiency', label: L('Hiệu suất H = công có ích / công toàn phần', 'Efficiency H = useful work / total work', '效率 H = 有用功 / 总功', '効率 H = 有用な仕事 / 全体の仕事', '효율 H = 유용한 일 / 전체 일') },
  ] },
  { id: 'equation', subject: 'chemistry', w: 360, h: 140, fields: ['variant', 'equation'], label: L('Phương trình phản ứng hoá học', 'Chemical reaction equation', '化学反应方程式', '化学反応式', '화학 반응식'), variants: [
    { id: 'water', label: L('Hiđro cháy tạo nước', 'Hydrogen burns to form water', '氢气燃烧生成水', '水素が燃えて水になる', '수소가 타서 물이 됨'), sample: 'H2 + O2 -> H2O' },
    { id: 'burn', label: L('Đốt metan tạo CO₂ và nước', 'Burn methane to CO₂ and water', '甲烷燃烧生成二氧化碳和水', 'メタンを燃やすと CO₂ と水', '메테인을 태우면 CO₂와 물'), sample: 'CH4 + O2 -> CO2 + H2O' },
    { id: 'rust', label: L('Sắt tác dụng với oxi', 'Iron reacts with oxygen', '铁与氧气反应', '鉄と酸素の反応', '철과 산소의 반응'), sample: 'Fe + O2 -> Fe2O3' },
    { id: 'neutral', label: L('Trung hoà axit và bazơ', 'Acid–base neutralisation', '酸碱中和', '酸と塩基の中和', '산과 염기의 중화'), sample: 'HCl + NaOH -> NaCl + H2O' },
    { id: 'carbon', label: L('Đốt cacbon tạo CO₂', 'Burn carbon to CO₂', '碳燃烧生成 CO₂', '炭素を燃やすと CO₂', '탄소를 태우면 CO₂'), sample: 'C + O2 -> CO2' },
    { id: 'lime', label: L('Nhiệt phân đá vôi', 'Lime decomposition', '石灰石分解', '石灰石の熱分解', '석회석 열분해'), sample: 'CaCO3 -> CaO + CO2' },
    { id: 'zinc', label: L('Kẽm tác dụng với axit clohiđric', 'Zinc reacts with hydrochloric acid', '锌与盐酸反应', '亜鉛と塩酸の反応', '아연과 염산의 반응'), sample: 'Zn + HCl -> ZnCl2 + H2' },
    { id: 'sodium', label: L('Natri tác dụng với nước', 'Sodium reacts with water', '钠与水反应', 'ナトリウムと水の反応', '나트륨과 물의 반응'), sample: 'Na + H2O -> NaOH + H2' },
    { id: 'alumina', label: L('Nhôm tác dụng với oxi', 'Aluminium reacts with oxygen', '铝与氧气反应', 'アルミニウムと酸素の反応', '알루미늄과 산소의 반응'), sample: 'Al + O2 -> Al2O3' },
    { id: 'displace', label: L('Kẽm đẩy đồng khỏi dung dịch', 'Zinc displaces copper', '锌置换出铜', '亜鉛が銅を追い出す', '아연이 구리를 밀어냄'), sample: 'CuSO4 + Zn -> ZnSO4 + Cu' },
  ] },
  { id: 'structure', subject: 'chemistry', w: 280, h: 180, fields: ['variant'], label: L('Cấu tạo phân tử', 'Molecular structure', '分子结构', '分子の構造', '분자 구조'), variants: [
    { id: 'water', label: L('Phân tử nước H₂O', 'Water molecule H₂O', '水分子 H₂O', '水分子 H₂O', '물 분자 H₂O') },
    { id: 'methane', label: L('Phân tử metan CH₄', 'Methane molecule CH₄', '甲烷分子 CH₄', 'メタン分子 CH₄', '메테인 분자 CH₄') },
    { id: 'co2', label: L('Phân tử cacbon đioxit CO₂', 'Carbon dioxide molecule CO₂', '二氧化碳分子 CO₂', '二酸化炭素分子 CO₂', '이산화 탄소 분자 CO₂') },
    { id: 'ethanol', label: L('Phân tử etanol C₂H₅OH', 'Ethanol molecule C₂H₅OH', '乙醇分子 C₂H₅OH', 'エタノール分子 C₂H₅OH', '에탄올 분자 C₂H₅OH') },
  ] },
  { id: 'glass', subject: 'chemistry', w: 260, h: 280, fields: ['variant', 'liquid', 'level', 'label'], label: L('Dụng cụ thuỷ tinh', 'Glassware', '玻璃器具', 'ガラス器具', '유리 기구'), variants: [
    { id: 'tube', label: L('Ống nghiệm', 'Test tube', '试管', '試験管', '시험관') },
    { id: 'beaker', label: L('Cốc thuỷ tinh', 'Beaker', '烧杯', 'ビーカー', '비커') },
    { id: 'erlenmeyer', label: L('Bình tam giác', 'Erlenmeyer flask', '锥形瓶', '三角フラスコ', '삼각 플라스크') },
    { id: 'flask', label: L('Bình cầu đáy tròn', 'Round-bottom flask', '圆底烧瓶', '丸底フラスコ', '둥근바닥 플라스크') },
    { id: 'cylinder', label: L('Ống đong', 'Graduated cylinder', '量筒', 'メスシリンダー', '눈금 실린더') },
    { id: 'lamp', label: L('Đèn cồn', 'Alcohol lamp', '酒精灯', 'アルコールランプ', '알코올 램프') },
    { id: 'funnel', label: L('Phễu', 'Funnel', '漏斗', '漏斗', '깔때기') },
    { id: 'basin', label: L('Chậu thuỷ tinh', 'Glass basin', '玻璃水槽', 'ガラス水槽', '유리 수조') },
    { id: 'burette', label: L('Buret trên giá', 'Burette on a stand', '铁架上的滴定管', 'スタンドのビュレット', '스탠드 위 뷰렛') },
    { id: 'tube-stand', label: L('Ống nghiệm kẹp trên giá', 'Test tube on a stand', '铁架上的试管', 'スタンドの試験管', '스탠드에 집게로 고정한 시험관') },
  ] },
  { id: 'chem-scheme', subject: 'chemistry', w: 320, h: 210, fields: ['variant'], label: L('Năng lượng phản ứng, pH, dãy hoạt động', 'Reaction energy, pH, activity series', '反应能量、pH、活动性', '反応エネルギー・pH・イオン化列', '반응 에너지·pH·활동도'), variants: [
    { id: 'energy', label: L('Sơ đồ năng lượng của phản ứng', 'Energy profile of a reaction', '反应的能量图', '反応のエネルギー図', '반응의 에너지 도표') },
    { id: 'ph', label: L('Thang pH từ axit đến bazơ', 'pH scale from acid to base', '从酸到碱的 pH 标度', '酸から塩基までの pH', '산에서 염기까지의 pH') },
    { id: 'activity', label: L('Dãy hoạt động hoá học của kim loại', 'Activity series of metals', '金属活动性顺序', '金属のイオン化列', '금속의 활동도 서열') },
  ] },
  { id: 'atom', subject: 'chemistry', w: 300, h: 210, fields: ['variant'], label: L('Nguyên tử và liên kết', 'Atom and chemical bonds', '原子与化学键', '原子と化学結合', '원자와 화학 결합'), variants: [
    { id: 'atom', label: L('Mô hình nguyên tử', 'Atom model', '原子模型', '原子模型', '원자 모형') },
    { id: 'covalent', label: L('Liên kết cộng hoá trị', 'Covalent bond', '共价键', '共有結合', '공유 결합') },
    { id: 'ionic', label: L('Liên kết ion giữa Na và Cl', 'Ionic bond between Na and Cl', '钠与氯的离子键', 'Na と Cl のイオン結合', 'Na와 Cl의 이온 결합') },
  ] },
  { id: 'periodic', subject: 'chemistry', w: 1180, h: 760, fields: ['label'], label: L('Bảng tuần hoàn các nguyên tố hoá học', 'Periodic table of the elements', '化学元素周期表', '元素の周期表', '화학 원소 주기율표') },
  { id: 'titration', subject: 'chemistry', w: 240, h: 280, fields: ['liquid', 'level', 'label'], label: L('Nhận biết axit, bazơ bằng quỳ tím', 'Identify acid and base with litmus', '用石蕊鉴别酸碱', 'リトマスで酸と塩基を見分ける', '리트머스로 산·염기 구별') },
  { id: 'chem-experiment', subject: 'chemistry', w: 380, h: 260, fields: ['variant'], label: L('Điện phân nước, thu khí, nhiệt phân', 'Electrolysis, collecting gas, heating limestone', '电解水、收集气体、热分解', '電気分解・気体捕集・熱分解', '전기분해·기체포집·열분해'), variants: [
    { id: 'electro', label: L('Điện phân nước', 'Electrolysis of water', '电解水', '水の電気分解', '물의 전기 분해') },
    { id: 'collect', label: L('Thu khí hiđro', 'Collect hydrogen', '收集氢气', '水素の捕集', '수소 포집') },
    { id: 'heat', label: L('Nhiệt phân đá vôi', 'Heat limestone', '加热石灰石', '石灰石の熱分解', '석회석 열분해') },
  ] },
  { id: 'formula-chem', subject: 'chemistry', w: 480, h: 168, fields: ['variant'], label: L('Công thức hoá học', 'Chemistry formulas', '化学公式', '化学の公式', '화학 공식'), variants: [
    { id: 'mole', label: L('Lượng chất n = m/M', 'Amount of substance n = m/M', '物质的量 n = m/M', '物質量 n = m/M', '물질량 n = m/M') },
    { id: 'count', label: L('Số hạt n = N/Nₐ', 'Particle count n = N/Nₐ', '粒子数 n = N/Nₐ', '粒子数 n = N/Nₐ', '입자 수 n = N/Nₐ') },
    { id: 'volume', label: L('Thể tích khí n = V/Vₘ', 'Gas volume n = V/Vₘ', '气体体积 n = V/Vₘ', '気体の体積 n = V/Vₘ', '기체 부피 n = V/Vₘ') },
    { id: 'conc', label: L('Nồng độ mol C = n/V', 'Molarity C = n/V', '物质的量浓度 C = n/V', 'モル濃度 C = n/V', '몰 농도 C = n/V') },
    { id: 'percent', label: L('Nồng độ phần trăm C% = khối lượng chất tan / dung dịch', 'Mass percent of solute', '质量分数：溶质质量 / 溶液质量', '質量パーセント：溶質 / 溶液', '질량 퍼센트: 용질 / 용액') },
    { id: 'convert', label: L('Đổi nồng độ phần trăm sang nồng độ mol', 'Convert percent to molarity', '质量分数换算成物质的量浓度', '質量%をモル濃度に換算', '퍼센트를 몰 농도로 환산') },
    { id: 'dilute', label: L('Pha loãng C₁V₁ = C₂V₂', 'Dilution C₁V₁ = C₂V₂', '稀释 C₁V₁ = C₂V₂', '希釈 C₁V₁ = C₂V₂', '묽히기 C₁V₁ = C₂V₂') },
    { id: 'density', label: L('Khối lượng riêng dung dịch d = m/V', 'Solution density d = m/V', '溶液密度 d = m/V', '溶液の密度 d = m/V', '용액 밀도 d = m/V') },
    { id: 'yield', label: L('Hiệu suất phản ứng: khối lượng thực tế / lí thuyết', 'Yield: actual mass / theoretical mass', '产率：实际质量 / 理论质量', '収率：実際の質量 / 理論質量', '수율: 실제 질량 / 이론 질량') },
    { id: 'element', label: L('% nguyên tố trong hợp chất', 'Element percent', '元素质量分数', '成分元素の質量%', '화합물 속 원소 %') },
    { id: 'ph', label: L('pH = −log[H⁺]', 'pH = −log[H⁺]', 'pH = −log[H⁺]', 'pH = −log[H⁺]', 'pH = −log[H⁺]') },
    { id: 'poh', label: L('pOH = −log[OH⁻]', 'pOH = −log[OH⁻]', 'pOH = −log[OH⁻]', 'pOH = −log[OH⁻]', 'pOH = −log[OH⁻]') },
    { id: 'ph-sum', label: L('pH + pOH = 14 ở 25 °C', 'pH + pOH = 14 at 25 °C', '25 °C 时 pH + pOH = 14', '25 °C で pH + pOH = 14', '25 °C에서 pH + pOH = 14') },
    { id: 'kw', label: L('Tích số ion của nước', 'Ion product of water', '水的离子积', '水のイオン積', '물의 이온곱') },
    { id: 'ka', label: L('Hằng số phân li axit Kₐ', 'Acid dissociation constant Kₐ', '酸解离常数 Kₐ', '酸解離定数 Kₐ', '산 해리 상수 Kₐ') },
    { id: 'buffer', label: L('pH của dung dịch đệm', 'pH of a buffer', '缓冲溶液的 pH', '緩衝液の pH', '완충 용액의 pH') },
    { id: 'rate', label: L('Tốc độ phản ứng v = ΔC/Δt', 'Reaction rate v = ΔC/Δt', '反应速率 v = ΔC/Δt', '反応速度 v = ΔC/Δt', '반응 속도 v = ΔC/Δt') },
    { id: 'kc', label: L('Hằng số cân bằng Kc của phản ứng', 'Equilibrium constant Kc', '反应的平衡常数 Kc', '反応の平衡定数 Kc', '반응의 평형 상수 Kc') },
    { id: 'gas', label: L('Phương trình trạng thái khí pV = nRT', 'Gas equation pV = nRT', '气体状态方程 pV = nRT', '気体の状態方程式 pV = nRT', '기체 상태 방정식 pV = nRT') },
    { id: 'electro', label: L('Khối lượng chất thu được khi điện phân', 'Mass deposited in electrolysis', '电解析出的质量', '電気分解で生じる質量', '전기 분해로 얻는 질량') },
    { id: 'alpha', label: L('Độ điện li α = số hạt phân li / số hạt ban đầu', 'Degree of dissociation α', '电离度 α', '電離度 α', '이온화도 α') },
    { id: 'titrate', menu: false, label: L('Chuẩn độ', 'Titration', '滴定', '滴定', '적정') },
  ] },
  { id: 'bio-graph', subject: 'biology', w: 320, h: 210, fields: ['variant'], label: L('Đồ thị tăng trưởng quần thể', 'Population growth graph', '种群增长图', '個体群の成長グラフ', '개체군 성장 그래프'), variants: [
    { id: 'logistic', label: L('Tăng trưởng logistic, chậm lại khi gần cực đại', 'Logistic growth, slowing near the limit', '逻辑增长，接近上限时变慢', 'ロジスティック成長、上限付近で減速', '로지스틱 성장, 한계 근처에서 느려짐') },
    { id: 'exponential', label: L('Tăng trưởng mũ, càng về sau càng nhanh', 'Exponential growth, faster over time', '指数增长，越往后越快', '指数成長、後になるほど速い', '지수 성장, 갈수록 빠름') },
  ] },
  { id: 'ecology', subject: 'biology', w: 320, h: 230, fields: ['variant'], label: L('Lưới thức ăn, tháp sinh thái', 'Food web and pyramid', '食物网与生态金字塔', '食物網・生態ピラミッド', '먹이 그물·생태 피라미드'), variants: [
    { id: 'web', label: L('Lưới thức ăn: ai ăn ai', 'Food web: who eats whom', '食物网：谁吃谁', '食物網：だれがだれを食べるか', '먹이 그물: 누가 누구를 먹나') },
    { id: 'pyramid', label: L('Tháp sinh thái: sinh khối theo bậc dinh dưỡng', 'Ecological pyramid of biomass', '生态金字塔：各营养级的生物量', '生態ピラミッド：栄養段階の生物量', '생태 피라미드: 영양 단계별 생물량') },
  ] },
  { id: 'genetic', subject: 'biology', w: 340, h: 180, fields: ['variant'], label: L('Cấu trúc ADN, dịch mã ARN', 'DNA structure and RNA translation', 'DNA 结构与 RNA 翻译', 'DNA の構造と RNA の翻訳', 'DNA 구조와 RNA 번역'), variants: [
    { id: 'dna', label: L('Mô hình chuỗi xoắn ADN', 'DNA double helix', 'DNA 双螺旋', 'DNA の二重らせん', 'DNA 이중 나선') },
    { id: 'codon', label: L('Dịch mã ARN thành protein', 'Translation of RNA into protein', 'RNA 翻译成蛋白质', 'RNA からタンパク質への翻訳', 'RNA를 단백질로 번역') },
  ] },
  { id: 'division', subject: 'biology', w: 380, h: 180, fields: ['variant'], label: L('Nguyên phân, giảm phân', 'Mitosis and meiosis', '有丝分裂与减数分裂', '体細胞分裂と減数分裂', '체세포 분열과 감수 분열'), variants: [
    { id: 'mitosis', label: L('Nguyên phân: một tế bào thành hai tế bào con', 'Mitosis: one cell becomes two', '有丝分裂：一个细胞变成两个', '体細胞分裂：1個が2個に', '체세포 분열: 세포 하나가 둘로') },
    { id: 'meiosis', label: L('Giảm phân: tạo giao tử, số nhiễm sắc thể giảm một nửa', 'Meiosis: gametes, chromosome number halves', '减数分裂：形成配子，染色体减半', '減数分裂：配偶子、染色体が半分', '감수 분열: 생식자, 염색체 수 절반') },
  ] },
  { id: 'cell', subject: 'biology', w: 320, h: 230, fields: ['variant'], label: L('Tế bào động vật, thực vật', 'Animal and plant cells', '动植物细胞', '動物細胞・植物細胞', '동물·식물 세포'), variants: [
    { id: 'animal', label: L('Tế bào động vật', 'Animal cell', '动物细胞', '動物細胞', '동물 세포') },
    { id: 'plant', label: L('Tế bào thực vật', 'Plant cell', '植物细胞', '植物細胞', '식물 세포') },
  ] },
  { id: 'pedigree', subject: 'biology', w: 280, h: 210, fields: [], label: L('Sơ đồ phả hệ di truyền', 'Inheritance pedigree', '遗传系谱', '遺伝の家系図', '유전 가계도') },
  { id: 'punnett', subject: 'biology', w: 240, h: 220, fields: ['variant'], label: L('Bảng Punnett', 'Punnett square', '庞氏方格', 'パネット方形', '퍼넷 사각형'), variants: [
    { id: 'mono', label: L('Một cặp alen Aa × Aa', 'Aa × Aa', 'Aa × Aa', 'Aa × Aa', 'Aa × Aa') },
    { id: 'test', label: L('Lai phân tích Aa × aa', 'Aa × aa', 'Aa × aa', 'Aa × aa', 'Aa × aa') },
  ] },
  { id: 'formula-bio', subject: 'biology', w: 320, h: 140, fields: ['variant'], label: L('Công thức quần thể', 'Population formulas', '种群公式', '個体群の公式', '개체군 공식'), variants: [
    { id: 'hardy', label: L('Hardy–Weinberg p² + 2pq + q² = 1', 'Hardy–Weinberg p² + 2pq + q² = 1', '哈迪-温伯格 p² + 2pq + q² = 1', 'ハーディ・ワインベルク p² + 2pq + q² = 1', '하디-바인베르크 p² + 2pq + q² = 1') },
    { id: 'growth', label: L('Tăng trưởng mũ quần thể Nₜ = N₀e^(rt)', 'Exponential population growth Nₜ = N₀e^(rt)', '种群指数增长 Nₜ = N₀e^(rt)', '個体群の指数成長 Nₜ = N₀e^(rt)', '개체군 지수 성장 Nₜ = N₀e^(rt)') },
  ] },
]

const itemMap = new Map(FIGURE_ITEMS.map((item) => [item.id, item]))

export function figureItem(id: string): FigureItem | null {
  return itemMap.get(id) ?? null
}

export function freshFigureParams(item: FigureItem): FigureParams {
  const variant = item.variants?.find((entry) => entry.menu !== false) ?? item.variants?.[0]
  return {
    variant: variant?.id ?? '',
    liquid: '#7dd3fc',
    level: 62,
    label: '',
    equation: variant?.sample ?? (item.id === 'equation' ? 'H2 + O2 -> H2O' : ''),
    tune: [],
    run: false,
    clock: 0,
    shift: 0,
  }
}

type Ctx = CanvasRenderingContext2D

const INK = {
  text: '#1e293b',
  muted: '#64748b',
  blue: '#2563eb',
  green: '#059669',
  amber: '#d97706',
  red: '#dc2626',
  violet: '#7c3aed',
  sky: '#0284c7',
  glass: '#dbeafe',
  image: '#c2410c',
} as const

type InkSpan = { text: string; color: string }

function ink(ctx: Ctx, color: string) {
  ctx.strokeStyle = color
  ctx.fillStyle = color
}

function spanWidth(text: string, size: number) {
  let width = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    width += (code >= 0x1100 ? 1 : 0.56) * size
  }
  return width
}

function richLine(ctx: Ctx, spans: InkSpan[], cx: number, y: number, size: number) {
  const widths = spans.map((span) => spanWidth(span.text, size))
  let x = cx - widths.reduce((sum, width) => sum + width, 0) / 2
  ctx.save()
  ctx.font = `${size}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  spans.forEach((span, index) => {
    ctx.fillStyle = span.color
    ctx.fillText(span.text, x, y)
    x += widths[index]
  })
  ctx.restore()
}

function arrow(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, head = 8) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  const ang = Math.atan2(y2 - y1, x2 - x1)
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang - 0.45), y2 - head * Math.sin(ang - 0.45))
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - head * Math.cos(ang + 0.45), y2 - head * Math.sin(ang + 0.45))
  ctx.stroke()
}

function textAt(ctx: Ctx, value: string, x: number, y: number, size = 13, color = '#1e293b') {
  ctx.save()
  ctx.fillStyle = color
  ctx.font = `${size}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(value, x, y)
  ctx.restore()
}

function cardFormula(ctx: Ctx, w: number, h: number, formula: string | InkSpan[], note: string | InkSpan[] = '') {
  ctx.save()
  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 1.5
  ctx.strokeRect(8, 8, w - 16, h - 16)
  ctx.restore()
  const formulaSpans = typeof formula === 'string' ? [{ text: formula, color: INK.blue }] : formula
  const noteSpans = typeof note === 'string' ? (note ? [{ text: note, color: INK.muted }] : []) : note
  const fit = (spans: InkSpan[], preferred: number) => {
    const unit = spans.reduce((sum, span) => sum + spanWidth(span.text, 1), 0)
    if (unit <= 0) return preferred
    return Math.max(12, Math.min(preferred, (w - 36) / unit))
  }
  richLine(ctx, formulaSpans, w / 2, h * 0.46, fit(formulaSpans, 26))
  if (noteSpans.length) richLine(ctx, noteSpans, w / 2, h * 0.74, fit(noteSpans, 13))
}

function axes(ctx: Ctx, x: number, y: number, x2: number, y2: number, xl: string, yl: string) {
  ink(ctx, INK.muted)
  arrow(ctx, x, y, x2, y)
  arrow(ctx, x, y, x, y2)
  textAt(ctx, xl, x2 - 8, y + 14, 12, INK.blue)
  textAt(ctx, yl, x + 12, y2 + 8, 12, INK.green)
}

function poly(ctx: Ctx, pts: Array<[number, number]>, close = false) {
  const first = pts[0]
  if (!first) return
  ctx.beginPath()
  ctx.moveTo(first[0], first[1])
  for (let i = 1; i < pts.length; i += 1) {
    const pt = pts[i]
    if (pt) ctx.lineTo(pt[0], pt[1])
  }
  if (close) ctx.closePath()
  ctx.stroke()
}

function resistor(ctx: Ctx, x: number, y: number, horizontal: boolean) {
  ink(ctx, INK.violet)
  ctx.beginPath()
  ctx.moveTo(horizontal ? x : x, horizontal ? y : y)
  const steps = 6
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const wobble = i % 2 === 0 ? 7 : -7
    if (horizontal) ctx.lineTo(x + t * 46, y + (i === steps ? 0 : wobble))
    else ctx.lineTo(x + (i === steps ? 0 : wobble), y + t * 46)
  }
  ctx.stroke()
}

function lamp(ctx: Ctx, x: number, y: number, lit = false) {
  ink(ctx, lit ? INK.amber : INK.muted)
  ctx.beginPath()
  ctx.arc(x, y, 12, 0, Math.PI * 2)
  ctx.fillStyle = lit ? '#fde68a' : '#f8fafc'
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 8, y - 8)
  ctx.lineTo(x + 8, y + 8)
  ctx.moveTo(x + 8, y - 8)
  ctx.lineTo(x - 8, y + 8)
  ctx.stroke()
}

function circuitLayout(w: number, h: number) {
  const xL = 86
  const xR = w - 36
  const yTop = 58
  const yBot = h - 50
  const midY = (yTop + yBot) / 2
  return {
    xL,
    xR,
    yTop,
    yBot,
    yPlus: midY - 30,
    yMinus: midY + 24,
    switchX: xL + 92,
  }
}

function cellSource(ctx: Ctx, x: number, yPlus: number, yMinus: number) {
  ctx.save()
  ctx.lineWidth = 3
  ink(ctx, INK.red)
  ctx.beginPath()
  ctx.moveTo(x - 16, yPlus)
  ctx.lineTo(x + 16, yPlus)
  ctx.stroke()
  ctx.lineWidth = 5
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(x - 9, yMinus)
  ctx.lineTo(x + 9, yMinus)
  ctx.stroke()
  ctx.restore()
  textAt(ctx, '+', x - 28, yPlus, 15, INK.red)
  textAt(ctx, '−', x - 28, yMinus, 15, INK.blue)
  textAt(ctx, 'ε', x + 24, (yPlus + yMinus) / 2, 14, INK.red)
}

function wireTo(ctx: Ctx, pts: Array<[number, number]>) {
  if (pts.length < 2) return
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.stroke()
}

function junction(ctx: Ctx, x: number, y: number) {
  ctx.beginPath()
  ctx.arc(x, y, 3.2, 0, Math.PI * 2)
  ctx.fillStyle = INK.text
  ctx.fill()
}

function flowDots(ctx: Ctx, pts: Array<[number, number]>, time: number, count: number) {
  const seg: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i += 1) {
    const len = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    seg.push(len)
    total += len
  }
  if (total < 1) return
  ink(ctx, INK.sky)
  for (let k = 0; k < count; k += 1) {
    let dist = wrap01(time * 0.16 + k / count) * total
    for (let i = 0; i < seg.length; i += 1) {
      const len = seg[i]
      if (dist <= len || i === seg.length - 1) {
        const t = len === 0 ? 0 : Math.min(1, dist / len)
        const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t
        const y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t
        ctx.beginPath()
        ctx.arc(x, y, 3.4, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      dist -= len
    }
  }
}

function dirArrow(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  ink(ctx, INK.green)
  arrow(ctx, mx - ux * 16, my - uy * 16, mx + ux * 12, my + uy * 12, 7)
}

function drawSwitch(ctx: Ctx, x: number, y: number, closed: boolean) {
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.arc(x - 18, y, 2.4, 0, Math.PI * 2)
  ctx.arc(x + 18, y, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - 18, y)
  if (closed) ctx.lineTo(x + 18, y)
  else ctx.lineTo(x + 2, y - 18)
  ctx.stroke()
  knob(ctx, closed ? x : x - 2, closed ? y : y - 10)
  textAt(ctx, 'K', x, y + 22, 12, INK.text)
}

function drawCircuit(ctx: Ctx, w: number, h: number, parallel: boolean, tune?: number[], time = 0) {
  const box = circuitLayout(w, h)
  const { xL, xR, yTop, yBot, yPlus, yMinus, switchX } = box
  const closed = tuneAt(tune, 0, 1) >= 0.5
  const lampX = switchX + (xR - switchX) * 0.48
  const resX = xL + (xR - xL) * 0.46
  wireTo(ctx, [[xL, yTop], [xL, yPlus]])
  wireTo(ctx, [[xL, yMinus], [xL, yBot]])
  cellSource(ctx, xL, yPlus, yMinus)
  wireTo(ctx, [[xL, yTop], [switchX - 18, yTop]])
  drawSwitch(ctx, switchX, yTop, closed)
  if (!parallel) {
    wireTo(ctx, [[switchX + 18, yTop], [lampX - 14, yTop]])
    wireTo(ctx, [[lampX + 14, yTop], [xR, yTop], [xR, yBot], [resX + 46, yBot]])
    wireTo(ctx, [[resX, yBot], [xL, yBot]])
    lamp(ctx, lampX, yTop, closed)
    resistor(ctx, resX, yBot, true)
    textAt(ctx, 'đèn', lampX, yTop - 22, 12, INK.amber)
    textAt(ctx, 'R', resX + 23, yBot - 18, 12, INK.violet)
    if (closed) {
      dirArrow(ctx, xL, yPlus, xL, yTop)
      dirArrow(ctx, lampX + 20, yTop, xR - 16, yTop)
      dirArrow(ctx, xR, yTop + 24, xR, yBot - 24)
      dirArrow(ctx, resX - 8, yBot, xL + 16, yBot)
      textAt(ctx, 'I', xR - 16, (yTop + yBot) / 2, 13, INK.green)
      flowDots(ctx, [
        [xL, yPlus], [xL, yTop], [switchX - 18, yTop], [switchX + 18, yTop],
        [lampX - 14, yTop], [lampX + 14, yTop], [xR, yTop], [xR, yBot],
        [resX + 46, yBot], [resX, yBot], [xL, yBot], [xL, yMinus],
      ], time, 4)
      textAt(ctx, 'Ngoài mạch, dòng chạy từ cực + về cực −.  I = ε / (Rđ + R)', w * 0.52, h - 16, 12, INK.green)
    } else {
      textAt(ctx, 'Khoá K mở, mạch hở, I = 0', w * 0.42, h - 16, 12, INK.muted)
    }
    return
  }
  const y1 = yTop + 34
  const y2 = yTop + (yBot - yTop) * 0.62
  const xSplit = switchX + 70
  const branchLamp = xSplit + (xR - xSplit) * 0.46
  const branchRes = xSplit + (xR - xSplit) * 0.34
  wireTo(ctx, [[switchX + 18, yTop], [xSplit, yTop], [xSplit, y1]])
  wireTo(ctx, [[xSplit, y1], [xSplit, y2]])
  wireTo(ctx, [[xSplit, y1], [branchLamp - 14, y1]])
  wireTo(ctx, [[branchLamp + 14, y1], [xR, y1]])
  wireTo(ctx, [[xSplit, y2], [branchRes, y2]])
  wireTo(ctx, [[branchRes + 46, y2], [xR, y2]])
  wireTo(ctx, [[xR, y1], [xR, y2], [xR, yBot], [xL, yBot]])
  lamp(ctx, branchLamp, y1, closed)
  resistor(ctx, branchRes, y2, true)
  junction(ctx, xSplit, y1)
  junction(ctx, xSplit, y2)
  junction(ctx, xR, y1)
  junction(ctx, xR, y2)
  textAt(ctx, 'đèn', branchLamp, y1 - 20, 12, INK.amber)
  textAt(ctx, 'R', branchRes + 23, y2 + 18, 12, INK.violet)
  if (closed) {
    dirArrow(ctx, xL, yPlus, xL, yTop)
    dirArrow(ctx, branchLamp + 28, y1, xR - 24, y1)
    dirArrow(ctx, branchRes + 58, y2, xR - 24, y2)
    dirArrow(ctx, xR, y2 + 12, xR, yBot - 10)
    dirArrow(ctx, xR - 30, yBot, xL + 24, yBot)
    textAt(ctx, 'I₁', branchLamp + 46, y1 - 14, 12, INK.green)
    textAt(ctx, 'I₂', branchRes + 70, y2 - 14, 12, INK.green)
    textAt(ctx, 'I', xR - 16, (y2 + yBot) / 2, 13, INK.green)
    const trunk: Array<[number, number]> = [[xL, yPlus], [xL, yTop], [switchX - 18, yTop], [switchX + 18, yTop], [xSplit, yTop], [xSplit, y1]]
    const back: Array<[number, number]> = [[xR, y2], [xR, yBot], [xL, yBot], [xL, yMinus]]
    flowDots(ctx, [...trunk, [branchLamp - 14, y1], [branchLamp + 14, y1], [xR, y1], ...back], time, 2)
    flowDots(ctx, [...trunk, [xSplit, y2], [branchRes, y2], [branchRes + 46, y2], ...back], time + 0.35, 2)
    textAt(ctx, 'Ngoài mạch, dòng chạy từ cực + về cực −.  I = I₁ + I₂', w * 0.5, h - 16, 12, INK.green)
  } else {
    textAt(ctx, 'Khoá K mở, mạch hở, I = 0', w * 0.42, h - 16, 12, INK.muted)
  }
}

function drawForce(ctx: Ctx, w: number, h: number, incline: boolean, tune?: number[], run = false) {
  if (!incline) {
    const y = h * 0.72
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.moveTo(24, y)
    ctx.lineTo(w - 24, y)
    ctx.stroke()
    for (let x = 32; x < w - 24; x += 14) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 8, y + 10)
      ctx.stroke()
    }
    const bx = clampNum(tuneAt(tune, 0, 0.42), 0.18, 0.7) * w
    ctx.fillStyle = '#e0f2fe'
    ctx.strokeStyle = INK.sky
    ctx.fillRect(bx, y - 52, 70, 52)
    ctx.strokeRect(bx, y - 52, 70, 52)
    ink(ctx, INK.blue)
    arrow(ctx, bx + 35, y - 26, bx + 120, y - 26)
    textAt(ctx, 'F', bx + 108, y - 40, 13, INK.blue)
    ink(ctx, INK.red)
    arrow(ctx, bx, y - 26, bx - 54, y - 26)
    textAt(ctx, 'f', bx - 40, y - 40, 13, INK.red)
    ink(ctx, INK.green)
    arrow(ctx, bx + 35, y - 52, bx + 35, y - 110)
    textAt(ctx, 'N', bx + 50, y - 96, 13, INK.green)
    ink(ctx, INK.violet)
    arrow(ctx, bx + 35, y, bx + 35, y + 46)
    textAt(ctx, 'mg', bx + 54, y + 36, 13, INK.violet)
    knob(ctx, bx + 35, y - 26)
    textAt(ctx, run ? 'a = (F − f) / m' : 'ΣF = 0, a = 0', w * 0.62, h - 12, 12, run ? INK.red : INK.green)
    if (run) {
      ink(ctx, INK.red)
      arrow(ctx, bx + 70, y - 40, bx + 108, y - 40)
      textAt(ctx, 'a', bx + 96, y - 52, 12, INK.red)
    }
    return
  }
  const x0 = 36
  const y0 = h - 28
  const x1 = w - 28
  const rise = 108
  const span = x1 - x0
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y0)
  ctx.lineTo(x0, y0 - rise)
  ctx.closePath()
  ctx.fillStyle = '#f8fafc'
  ctx.fill()
  ctx.stroke()
  const ang = Math.atan2(rise, span)
  const along = clampNum(tuneAt(tune, 0, 0.48), 0.22, 0.78)
  const bx = x0 + span * along
  const by = y0 - rise * (1 - along)
  ctx.save()
  ctx.translate(bx, by)
  ctx.rotate(ang)
  ctx.fillStyle = '#e0f2fe'
  ctx.strokeStyle = INK.sky
  ctx.fillRect(-26, -30, 52, 30)
  ctx.strokeRect(-26, -30, 52, 30)
  ctx.restore()
  const nx = Math.sin(ang)
  const ny = -Math.cos(ang)
  ink(ctx, INK.green)
  arrow(ctx, bx + nx * 8, by - 16 + ny * 8, bx + nx * 52, by - 16 + ny * 52)
  textAt(ctx, 'N', bx + nx * 60, by - 16 + ny * 60, 13, INK.green)
  ink(ctx, INK.violet)
  arrow(ctx, bx + 10, by - 8, bx + 10, by + 46)
  textAt(ctx, 'mg', bx + 28, by + 36, 13, INK.violet)
  const downX = Math.cos(ang)
  const downY = Math.sin(ang)
  ink(ctx, INK.amber)
  arrow(ctx, bx - 6, by - 22, bx - 6 + downX * 46, by - 22 + downY * 46)
  textAt(ctx, 'mg sin α', bx + downX * 54, by - 30 + downY * 54, 12, INK.amber)
  if (run) {
    ink(ctx, INK.red)
    arrow(ctx, bx + 8, by - 30, bx + 8 + downX * 36, by - 30 + downY * 36)
    textAt(ctx, 'a', bx + 8 + downX * 48, by - 30 + downY * 48, 13, INK.red)
  } else {
    ink(ctx, INK.red)
    arrow(ctx, bx + 8, by - 30, bx + 8 - downX * 36, by - 30 - downY * 36)
    textAt(ctx, 'f', bx + 8 - downX * 48, by - 30 - downY * 48, 13, INK.red)
  }
  ink(ctx, INK.red)
  ctx.beginPath()
  ctx.arc(x1, y0, 28, Math.PI, Math.PI + ang, false)
  ctx.stroke()
  const mid = Math.PI + ang / 2
  textAt(ctx, 'α', x1 + Math.cos(mid) * 42, y0 + Math.sin(mid) * 42, 13, INK.red)
  knob(ctx, bx, by)
  textAt(ctx, run ? 'bỏ ma sát: a = g sin α, trượt xuống' : 'đứng yên: f hướng lên dốc, f = mg sin α', w * 0.46, h - 10, 11, run ? INK.red : INK.green)
}

function lens(ctx: Ctx, cx: number, cy: number, convex: boolean) {
  const half = 68
  ctx.beginPath()
  if (convex) {
    ctx.moveTo(cx, cy - half)
    ctx.quadraticCurveTo(cx + 22, cy, cx, cy + half)
    ctx.quadraticCurveTo(cx - 22, cy, cx, cy - half)
    ctx.closePath()
  } else {
    const rim = 18
    const waist = 3.5
    ctx.moveTo(cx - rim, cy - half)
    ctx.lineTo(cx + rim, cy - half)
    ctx.quadraticCurveTo(cx + waist, cy, cx + rim, cy + half)
    ctx.lineTo(cx - rim, cy + half)
    ctx.quadraticCurveTo(cx - waist, cy, cx - rim, cy - half)
    ctx.closePath()
  }
  ctx.fillStyle = INK.glass
  ctx.strokeStyle = INK.sky
  ctx.fill()
  ctx.stroke()
}

function focalDot(ctx: Ctx, x: number, y: number, label: string) {
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.arc(x, y, 2.3, 0, Math.PI * 2)
  ctx.fill()
  textAt(ctx, label, x, y + 14, 11, INK.amber)
}

function clampNum(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n))
}

function tuneAt(tune: number[] | undefined, index: number, fallback: number) {
  const value = tune?.[index]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Pha 0..1. `%` của số âm trong JS vẫn âm, dùng làm chỉ số mảng sẽ đọc phần tử không tồn tại. */
function wrap01(value: number) {
  if (!Number.isFinite(value)) return 0
  const frac = value % 1
  return frac < 0 ? frac + 1 : frac
}

function finiteOr(value: number | undefined, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function knob(ctx: Ctx, x: number, y: number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, 7, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = INK.sky
  ctx.lineWidth = 1.5
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

function guide(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, h: number, dashed = false) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(2, 2, Math.max(0, w - 4), Math.max(0, h - 4))
  ctx.clip()
  if (dashed) ctx.setLineDash([5, 3])
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

function farPoint(x1: number, y1: number, x2: number, y2: number, len = 900) {
  const dx = x2 - x1
  const dy = y2 - y1
  const dist = Math.hypot(dx, dy) || 1
  return [x1 + (dx / dist) * len, y1 + (dy / dist) * len] as const
}

/** d, d' theo đơn vị tiêu cự. 1/f = 1/d + 1/d', f > 0 hội tụ. */
export function lensImage(convex: boolean, ratio: number) {
  const f = convex ? 1 : -1
  const d = clampNum(ratio, 0.42, 2.75)
  const denom = 1 / f - 1 / d
  const finite = Math.abs(denom) > 0.0012 && Math.abs(1 / denom) < 3.2
  const dPrime = finite ? 1 / denom : 0
  const k = finite ? -dPrime / d : 0
  return { dPrime, k, virtual: finite && dPrime < 0, finite }
}

function lensMetrics(w: number, h: number, convex: boolean, tune?: number[]) {
  const cy = h * 0.56
  const fAbs = Math.max(40, Math.min(72, w * 0.155))
  const cx = w * 0.5
  const ratio = clampNum(tuneAt(tune, 0, convex ? 2 : 1.71), 0.42, 2.75)
  const objFrac = clampNum(tuneAt(tune, 1, convex ? 0.155 : 0.182), -0.36, 0.38)
  const image = lensImage(convex, ratio)
  const objH = objFrac * h
  const ox = cx - ratio * fAbs
  const oy = cy - objH
  const ix = cx + image.dPrime * fAbs
  const iy = cy - image.k * objH
  return { cx, cy, fAbs, ratio, objFrac, ox, oy, ix, iy, objH, ...image }
}

function springShift(rest: number, ampFrac: number, h: number, tune: number[] | undefined, time: number) {
  const amp = clampNum(tuneAt(tune, 0, ampFrac), -0.22, 0.22) * h
  const held = tuneAt(tune, 2, 0) > 0.5
  const t0 = tuneAt(tune, 1, 0)
  const shift = held ? amp : amp * Math.cos((time - t0) * 2.4)
  return rest + shift
}

function pendulumPose(w: number, h: number, tune: number[] | undefined, time: number) {
  const x = w * 0.58
  const y = 28
  const len = Math.hypot(58, 116)
  const amp = clampNum(tuneAt(tune, 0, -0.46), -1.15, 1.15)
  const held = tuneAt(tune, 2, 0) > 0.5
  const t0 = tuneAt(tune, 1, 0)
  const swing = clampNum(held ? amp : amp * Math.cos((time - t0) * 2.1), -1.15, 1.15)
  return { x, y, len, bx: x + Math.sin(swing) * len, by: y + Math.cos(swing) * len, swing }
}

function projectilePose(w: number, h: number, tune: number[] | undefined, time: number) {
  const ground = h - 36
  const x0 = 36
  const angle = clampNum(tuneAt(tune, 0, 0.9), 0.25, 1.3)
  const speed = clampNum(tuneAt(tune, 1, 0.58), 0.22, 0.92) * w
  const g = h * 1
  const vx = Math.cos(angle) * speed
  const vy = Math.sin(angle) * speed
  const tmax = g > 0 ? (2 * vy) / g : 1
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= 24; i += 1) {
    const t = (tmax * i) / 24
    const px = x0 + vx * t
    const py = ground - vy * t + 0.5 * g * t * t
    if (i > 0 && py > ground + 0.5) break
    pts.push([px, Math.min(ground, py)])
  }
  if (pts.length === 0) pts.push([x0, ground])
  const phase = wrap01(time * 0.28)
  const flight = phase * (Number.isFinite(tmax) ? tmax : 1)
  const last = pts.length - 1
  const ball = pts[Math.min(last, Math.max(0, Math.round(phase * last)))] ?? pts[0] ?? [x0, ground]
  const len = clampNum(tuneAt(tune, 1, 0.58), 0.22, 0.92) * 80
  return {
    ground,
    x0,
    angle,
    pts,
    ball,
    vx,
    vy,
    g,
    flight,
    hx: x0 + Math.cos(angle) * len,
    hy: ground - Math.sin(angle) * len,
  }
}

function chargePose(w: number, h: number, tune?: number[]) {
  return {
    x1: clampNum(tuneAt(tune, 0, 0.34), 0.14, 0.8) * w,
    y1: clampNum(tuneAt(tune, 1, 0.5), 0.28, 0.78) * h,
    x2: clampNum(tuneAt(tune, 2, 0.66), 0.2, 0.88) * w,
    y2: clampNum(tuneAt(tune, 3, 0.5), 0.28, 0.78) * h,
  }
}

function snellPose(w: number, h: number, tune?: number[]) {
  const hx = w * 0.48
  const hy = h * 0.48
  const deg = clampNum(tuneAt(tune, 0, 42), 8, 72)
  const i = (deg * Math.PI) / 180
  const r = Math.asin(Math.min(0.999, Math.sin(i) / 1.5))
  const len = 78
  return {
    hx,
    hy,
    deg,
    x1: hx - Math.sin(i) * len,
    y1: hy - Math.cos(i) * len,
    x2: hx + Math.sin(r) * 74,
    y2: hy + Math.cos(r) * 74,
    rDeg: (r * 180) / Math.PI,
  }
}

function titrationOpen(tune?: number[]) {
  return clampNum(tuneAt(tune, 0, 0), 0, 1)
}

function titrationCock(w: number, h: number) {
  return { x: w * 0.44, y: h * 0.4 }
}

const TITRATION_SPAN = 36
const TITRATION_SECONDS = 16

function titrationSpin(value: number) {
  if (!Number.isFinite(value)) return 0
  const spun = value % TITRATION_SPAN
  return spun < 0 ? spun + TITRATION_SPAN : spun
}

function titrationPoured(tune: number[] | undefined, time: number) {
  const held = titrationSpin(tuneAt(tune, 1, 0))
  const open = titrationOpen(tune)
  if (open <= 0.02) return held
  const t0 = tuneAt(tune, 2, 0)
  const now = Number.isFinite(time) ? time : 0
  const elapsed = Math.max(0, now - t0)
  return titrationSpin(held + open * elapsed * (TITRATION_SPAN / TITRATION_SECONDS))
}

const TITRATION_ACID = 10
const TITRATION_BASE = 16

/** Bazơ trong buret chảy vào axit trong bình. Điểm tương đương khi đã chảy hết 10 phần bazơ. */
function titrationMix(poured: number) {
  const flowed = (clampNum(poured, 0, 36) / 36) * TITRATION_BASE
  return {
    acidLeft: Math.max(0, TITRATION_ACID - flowed),
    baseLeft: Math.max(0, TITRATION_BASE - flowed),
    excess: Math.max(0, flowed - TITRATION_ACID),
  }
}

function hexChannel(hex: string, index: number) {
  const body = hex.replace('#', '')
  const full = body.length === 3 ? body.split('').map((ch) => ch + ch).join('') : body
  const n = Number.parseInt(full.slice(index * 2, index * 2 + 2), 16)
  return Number.isFinite(n) ? n : 0
}

function mixHex(from: string, to: string, t: number) {
  const k = clampNum(t, 0, 1)
  const channel = (index: number) => Math.round(hexChannel(from, index) + (hexChannel(to, index) - hexChannel(from, index)) * k)
  const byte = (n: number) => n.toString(16).padStart(2, '0')
  return `#${byte(channel(0))}${byte(channel(1))}${byte(channel(2))}`
}

/** Phenolphtalein: không màu khi còn H⁺ hoặc vừa hết, hồng chỉ khi có OH⁻ dư và đậm dần. */
export function phenolphthaleinColor(acidLeft: number, excess: number) {
  const extra = clampNum(excess / (TITRATION_BASE - TITRATION_ACID), 0, 1)
  if (acidLeft > 0.05 || extra <= 0) return '#f8fafc'
  return mixHex('#fbcfe8', '#be185d', 0.28 + extra * 0.72)
}

/** Giấy quỳ tím: đỏ khi còn axit rõ, tím quanh trung hòa, xanh khi bazơ dư. */
export function litmusColor(acidLeft: number, excess: number) {
  const acid = clampNum(acidLeft, 0, TITRATION_ACID)
  const extra = clampNum(excess, 0, TITRATION_BASE - TITRATION_ACID)
  if (acid >= 1.5) return '#dc2626'
  if (acid > 0) return mixHex('#dc2626', '#7e22ce', 1 - acid / 1.5)
  if (extra <= 0.4) return '#7e22ce'
  return mixHex('#7e22ce', '#1d4ed8', clampNum((extra - 0.4) / (TITRATION_BASE - TITRATION_ACID - 0.4), 0, 1))
}

export function litmusWord(acidLeft: number, excess: number) {
  if (acidLeft >= 1) return 'đỏ'
  if (acidLeft <= 0 && excess > 0.4) return 'xanh'
  return 'tím'
}

const LAB_RUN = new Set(['ray', 'circuit', 'force', 'wave', 'field', 'refraction', 'experiment-phys', 'interfere', 'young', 'chem-experiment', 'titration', 'spatial'])

export function figureClock(params: { run?: boolean; clock?: number; shift?: number } | undefined, sim: number) {
  const clock = finiteOr(params?.clock)
  const shift = finiteOr(params?.shift)
  const now = finiteOr(sim)
  if (!params?.run) return clock
  const t = now - shift
  return Number.isFinite(t) ? t : 0
}

export function toggleTitrationValve(params: FigureParams, time: number): FigureParams {
  const now = Number.isFinite(time) ? time : 0
  const held = titrationPoured(params.tune, now)
  const open = titrationOpen(params.tune) > 0.2 ? 0 : 1
  return { ...params, tune: [open, held, now] }
}

export function toggleFigureRun<T extends { run?: boolean; clock?: number; shift?: number }>(params: T, sim: number): T {
  const shift = finiteOr(params.shift)
  const clock = finiteOr(params.clock)
  const now = finiteOr(sim)
  if (params.run) return { ...params, run: false, clock: now - shift }
  return { ...params, run: true, shift: now - clock }
}

function playMark(ctx: Ctx, w: number, run: boolean) {
  const x = w - 18
  const y = 16
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, 9, 0, Math.PI * 2)
  ctx.fillStyle = run ? '#dcfce7' : '#f8fafc'
  ctx.strokeStyle = run ? INK.green : INK.muted
  ctx.lineWidth = 1.5
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  if (run) {
    ctx.moveTo(x - 3, y - 4)
    ctx.lineTo(x - 3, y + 4)
    ctx.moveTo(x + 2, y - 4)
    ctx.lineTo(x + 2, y + 4)
  } else {
    ctx.moveTo(x - 3, y - 5)
    ctx.lineTo(x + 5, y)
    ctx.lineTo(x - 3, y + 5)
    ctx.closePath()
  }
  ctx.stroke()
  ctx.restore()
  textAt(ctx, run ? 'chạy' : 'đứng im', w - 52, 16, 10, run ? INK.green : INK.muted)
}

function springDetail(ctx: Ctx, w: number, h: number, cx: number, rest: number, eq: number, ampFrac: number, tune: number[] | undefined) {
  const amp = clampNum(tuneAt(tune, 0, ampFrac), -0.22, 0.22) * h
  const disp = eq - rest
  const scale = Math.max(Math.abs(amp), 4)
  const potential = Math.min(1, (disp * disp) / (scale * scale))
  const kinetic = Math.max(0, 1 - potential)
  if (Math.abs(disp) > 2) {
    ink(ctx, INK.red)
    arrow(ctx, cx + 28, eq - 13, cx + 28, eq - 13 - Math.sign(disp) * Math.min(34, Math.abs(disp)))
    textAt(ctx, 'F = −kx', cx + 62, eq - 20, 11, INK.red)
  } else {
    textAt(ctx, 'x = 0, F = 0', cx + 58, eq - 20, 11, INK.muted)
  }
  energySplit(ctx, w - 108, h - 18, 64, kinetic, potential)
}

function energySplit(ctx: Ctx, x: number, y: number, width: number, kinetic: number, potential: number) {
  const sum = Math.max(0.001, kinetic + potential)
  const kW = (width * kinetic) / sum
  ctx.save()
  ctx.fillStyle = '#fde68a'
  ctx.fillRect(x, y, Math.max(0, kW), 7)
  ctx.fillStyle = '#bbf7d0'
  ctx.fillRect(x + kW, y, Math.max(0, width - kW), 7)
  ctx.strokeStyle = INK.muted
  ctx.lineWidth = 1
  ctx.strokeRect(x, y, width, 7)
  ctx.restore()
  textAt(ctx, 'K', x + 8, y - 8, 10, INK.amber)
  textAt(ctx, 'U', x + width - 8, y - 8, 10, INK.green)
}

function drawRay(ctx: Ctx, w: number, h: number, convex: boolean, tune?: number[], time = 0) {
  const s = lensMetrics(w, h, convex, tune)
  const { cx, cy, fAbs, ox, oy, ix, iy } = s
  ink(ctx, INK.muted)
  arrow(ctx, 14, cy, w - 12, cy)
  lens(ctx, cx, cy, convex)
  focalDot(ctx, cx - fAbs, cy, 'F')
  focalDot(ctx, cx + fAbs, cy, "F'")
  ink(ctx, INK.blue)
  arrow(ctx, ox, cy, ox, oy)
  textAt(ctx, 'vật', ox - 18, oy + 10, 11, INK.blue)
  knob(ctx, ox, oy)
  if (s.finite) {
    const onCard = ix > 16 && ix < w - 16 && iy > 14 && iy < h - 14
    ink(ctx, s.virtual ? INK.violet : INK.image)
    if (onCard) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(2, 2, w - 4, h - 4)
      ctx.clip()
      if (s.virtual) ctx.setLineDash([5, 3])
      arrow(ctx, ix, cy, ix, iy)
      ctx.restore()
      textAt(ctx, s.virtual ? 'ảnh ảo' : 'ảnh', ix + (s.virtual ? -22 : 18), iy - 12, 11, s.virtual ? INK.violet : INK.image)
    } else {
      textAt(ctx, s.virtual ? 'ảnh ảo' : 'ảnh', w * 0.72, 18, 12, s.virtual ? INK.violet : INK.image)
    }
  } else {
    textAt(ctx, 'ảnh ở vô cực', w * 0.72, 18, 12, INK.image)
  }
  ink(ctx, INK.blue)
  guide(ctx, ox, oy, cx, oy, w, h)
  if (convex) {
    const [px, py] = farPoint(cx, oy, cx + fAbs, cy)
    guide(ctx, cx, oy, px, py, w, h)
    if (s.virtual) {
      const [bx, by] = farPoint(cx, oy, cx - fAbs, oy - (cy - oy))
      guide(ctx, cx, oy, bx, by, w, h, true)
    }
  } else {
    const [px, py] = farPoint(cx - fAbs, cy, cx, oy)
    guide(ctx, cx, oy, px, py, w, h)
    const [bx, by] = farPoint(cx, oy, cx - fAbs, cy)
    guide(ctx, cx, oy, bx, by, w, h, true)
  }
  ink(ctx, INK.green)
  const [cx2, cy2] = farPoint(ox, oy, cx, cy)
  guide(ctx, ox, oy, cx2, cy2, w, h)
  if (s.virtual) {
    const [bx, by] = farPoint(cx, cy, ox, oy)
    guide(ctx, ox, oy, bx, by, w, h, true)
  }
  const fx = convex ? cx - fAbs : cx + fAbs
  if (Math.abs(fx - ox) > 10) {
    const yL = oy + ((cy - oy) * (cx - ox)) / (fx - ox)
    ink(ctx, INK.amber)
    guide(ctx, ox, oy, cx, yL, w, h)
    guide(ctx, cx, yL, w + 80, yL, w, h)
    if (s.virtual || !convex) guide(ctx, cx, yL, -40, yL, w, h, true)
  }
  const pulse = wrap01(time * 0.35)
  const px = ox + (cx - ox) * pulse
  const py = oy + (cy - oy) * pulse
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.arc(px, py, 3.5, 0, Math.PI * 2)
  ctx.fill()
  const kind = !s.finite ? 'ảnh ở vô cực' : s.virtual ? 'ảnh ảo, cùng chiều' : 'ảnh thật, ngược'
  const dPrime = s.finite ? `d' ${s.dPrime.toFixed(1)}f` : "d' ∞"
  textAt(ctx, `d ${s.ratio.toFixed(1)}f   ${dPrime}   k ${s.finite ? s.k.toFixed(2) : '0'}`, w * 0.34, h - 12, 11, INK.text)
  textAt(ctx, kind, w * 0.34, h - 26, 11, s.virtual ? INK.violet : INK.image)
}

function plotLine(ctx: Ctx, pts: Array<[number, number]>) {
  const first = pts[0]
  if (!first) return
  ctx.beginPath()
  ctx.moveTo(first[0], first[1])
  for (let i = 1; i < pts.length; i += 1) {
    const pt = pts[i]
    if (pt) ctx.lineTo(pt[0], pt[1])
  }
  ctx.stroke()
}

function drawPhysGraph(ctx: Ctx, w: number, h: number, kind: string) {
  const x = 42
  const y = h - 36
  if (kind === 'xt') {
    axes(ctx, x, y, w - 16, 22, 't', 'x')
    ink(ctx, INK.blue)
    plotLine(ctx, [[x, y - 16], [w - 40, 36]])
    textAt(ctx, 'x₀', x + 14, y - 8, 11, INK.muted)
    textAt(ctx, 'đều', w * 0.62, 24, 12, INK.blue)
    return
  }
  if (kind === 'at') {
    axes(ctx, x, y, w - 16, 22, 't', 'a')
    ink(ctx, INK.green)
    plotLine(ctx, [[x, y - 64], [w * 0.5, y - 64], [w * 0.5, y], [w - 28, y]])
    textAt(ctx, 'a > 0', w * 0.28, y - 78, 12, INK.green)
    textAt(ctx, 'a = 0', w * 0.72, y - 16, 12, INK.muted)
    return
  }
  axes(ctx, x, y, w - 16, 22, 't', 'v')
  ink(ctx, INK.amber)
  plotLine(ctx, [[x, y - 12], [w * 0.5, y - 86], [w - 28, y - 86]])
  textAt(ctx, 'v₀', x + 16, y - 4, 11, INK.muted)
  textAt(ctx, 'a > 0', w * 0.28, y - 100, 12, INK.amber)
  textAt(ctx, 'a = 0', w * 0.72, y - 100, 12, INK.green)
}

function drawSpatial(ctx: Ctx, w: number, h: number, equation: string, time = 0) {
  const body = equation.trim() || 'x^2+y^2'
  const expr = parseMathExpr(body) ?? parseMathExpr('x^2+y^2')
  const cx = w * 0.5
  const cy = h * 0.56
  const rot = time * 0.55
  const c = Math.cos(rot)
  const s = Math.sin(rot)
  const n = 14
  const span = 1.6
  const grid: number[][] = []
  let peak = 0.001
  for (let j = 0; j <= n; j += 1) {
    const row: number[] = []
    const y = -span + (2 * span * j) / n
    for (let i = 0; i <= n; i += 1) {
      const x = -span + (2 * span * i) / n
      const z = expr ? evalMathExpr(expr, { x, y, pi: Math.PI, e: Math.E }) : x * x + y * y
      const value = z == null || !Number.isFinite(z) ? 0 : Math.max(-6, Math.min(6, z))
      row.push(value)
      peak = Math.max(peak, Math.abs(value))
    }
    grid.push(row)
  }
  const project = (x: number, y: number, z: number) => {
    const xr = x * c - y * s
    const yr = x * s + y * c
    const scale = Math.min(w, h) * 0.22
    return [cx + xr * scale, cy - (z / peak) * scale * 0.55 + yr * scale * 0.42] as const
  }
  ink(ctx, INK.muted)
  ctx.lineWidth = 1
  for (let j = 0; j <= n; j += 1) {
    ctx.beginPath()
    for (let i = 0; i <= n; i += 1) {
      const x = -span + (2 * span * i) / n
      const y = -span + (2 * span * j) / n
      const [px, py] = project(x, y, grid[j][i])
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  ink(ctx, INK.blue)
  for (let i = 0; i <= n; i += 1) {
    ctx.beginPath()
    for (let j = 0; j <= n; j += 1) {
      const x = -span + (2 * span * i) / n
      const y = -span + (2 * span * j) / n
      const [px, py] = project(x, y, grid[j][i])
      if (j === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  textAt(ctx, `z = ${body}`, w / 2, 18, 13, INK.text)
  textAt(ctx, 'x', w * 0.78, h * 0.62, 12, INK.red)
  textAt(ctx, 'y', w * 0.38, h * 0.78, 12, INK.green)
  textAt(ctx, 'z', w * 0.52, h * 0.28, 12, INK.blue)
}

export function figureSimulates(id: string, variant = '', run = false): boolean {
  if (!run) return false
  if (id === 'spatial' || id === 'experiment-phys' || id === 'interfere' || id === 'young' || id === 'wave' || id === 'field' || id === 'chem-experiment' || id === 'titration' || id === 'ray' || id === 'circuit' || id === 'refraction') return true
  return variant === 'pendulum'
}

function drawWave(ctx: Ctx, w: number, h: number, kind = 'wave', time = 0, tune?: number[]) {
  if (kind === 'spring') {
    const cx = w * 0.4
    const top = 26
    const rest = h * 0.62
    const eq = springShift(rest, 18 / 210, h, tune, time)
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.moveTo(cx - 64, top)
    ctx.lineTo(cx + 64, top)
    ctx.moveTo(cx, top)
    ctx.lineTo(cx, top + 14)
    ctx.stroke()
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.moveTo(cx, top + 14)
    const coils = 8
    const coilEnd = eq - 34
    for (let i = 1; i <= coils; i += 1) {
      const yy = top + 14 + ((coilEnd - top - 14) * i) / coils
      ctx.lineTo(cx + (i % 2 === 0 ? 14 : -14), yy)
    }
    ctx.lineTo(cx, coilEnd)
    ctx.stroke()
    ctx.fillStyle = '#e0f2fe'
    ctx.strokeStyle = INK.sky
    ctx.fillRect(cx - 22, eq - 30, 44, 34)
    ctx.strokeRect(cx - 22, eq - 30, 44, 34)
    textAt(ctx, 'm', cx, eq - 13, 13, INK.blue)
    ink(ctx, INK.muted)
    ctx.save()
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(cx + 36, rest - 13)
    ctx.lineTo(w - 20, rest - 13)
    ctx.stroke()
    ctx.restore()
    textAt(ctx, 'cân bằng', w - 48, rest - 26, 11, INK.muted)
    if (Math.abs(eq - rest) > 6) {
      ink(ctx, INK.green)
      arrow(ctx, cx + 40, rest - 13, cx + 40, eq - 13)
      textAt(ctx, 'A', cx + 54, (rest + eq) / 2 - 13, 12, INK.green)
    }
    textAt(ctx, 'lò xo', cx - 40, (top + eq) / 2, 12, INK.sky)
    knob(ctx, cx, eq - 13)
    springDetail(ctx, w, h, cx, rest, eq, 18 / 210, tune)
    return
  }
  if (kind === 'osc') {
    const x = 40
    const y = h * 0.56
    axes(ctx, x, y, w - 16, 18, 't', 'x')
    const amp = clampNum(tuneAt(tune, 0, 0.16), 0.06, 0.32) * h
    const pts: Array<[number, number]> = []
    const x1 = w - 36
    for (let i = 0; i <= 60; i += 1) {
      const t = i / 60
      pts.push([x + t * (x1 - x), y - Math.sin(t * Math.PI * 2) * amp])
    }
    ink(ctx, INK.violet)
    plotLine(ctx, pts)
    const periodY = y - amp - 14
    ink(ctx, INK.amber)
    ctx.save()
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(pts[0][0], periodY)
    ctx.lineTo(pts[60][0], periodY)
    ctx.moveTo(pts[0][0], periodY)
    ctx.lineTo(pts[0][0], y)
    ctx.moveTo(pts[60][0], periodY)
    ctx.lineTo(pts[60][0], y)
    ctx.stroke()
    ctx.restore()
    textAt(ctx, 'T', (pts[0][0] + pts[60][0]) / 2, periodY - 10, 12, INK.amber)
    ink(ctx, INK.green)
    arrow(ctx, x + 10, y, x + 10, y - amp)
    knob(ctx, x + 10, y - amp)
    textAt(ctx, 'A', x + 22, y - amp * 0.5, 12, INK.green)
    const phase = wrap01(time * 0.28)
    const sx = Math.sin(phase * Math.PI * 2)
    const vx = Math.cos(phase * Math.PI * 2)
    textAt(ctx, `x ${sx.toFixed(1)}   v ${vx.toFixed(1)}   a ${(-sx).toFixed(1)}`, w * 0.62, h - 12, 11, INK.text)
    const dot = pts[Math.min(pts.length - 1, Math.max(0, Math.round(phase * (pts.length - 1))))]
    if (dot) {
      ink(ctx, INK.red)
      ctx.beginPath()
      ctx.arc(dot[0], dot[1], 4, 0, Math.PI * 2)
      ctx.fill()
    }
    return
  }
  const y = h * 0.55
  const x0 = 36
  const x1 = w - 28
  const amp = clampNum(tuneAt(tune, 0, 0.17), 0.06, 0.32) * h
  ink(ctx, INK.muted)
  arrow(ctx, x0, y, x1, y)
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= 80; i += 1) {
    const t = i / 80
    pts.push([x0 + t * (x1 - x0 - 10), y - Math.sin(t * Math.PI * 4 - time * 2.6) * amp])
  }
  ink(ctx, INK.blue)
  plotLine(ctx, pts)
  ink(ctx, INK.green)
  arrow(ctx, x0 + 20, y, x0 + 20, y - amp)
  knob(ctx, x0 + 20, y - amp)
  textAt(ctx, 'A', x0 + 32, y - amp * 0.5, 12, INK.green)
  const waveMark = y - amp - 16
  ink(ctx, INK.amber)
  ctx.save()
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(pts[10][0], waveMark)
  ctx.lineTo(pts[50][0], waveMark)
  ctx.moveTo(pts[10][0], waveMark)
  ctx.lineTo(pts[10][0], pts[10][1])
  ctx.moveTo(pts[50][0], waveMark)
  ctx.lineTo(pts[50][0], pts[50][1])
  ctx.stroke()
  ctx.restore()
  textAt(ctx, 'λ', (pts[10][0] + pts[50][0]) / 2, waveMark - 10, 13, INK.amber)
  textAt(ctx, 'x', x1 - 6, y + 14, 12, INK.muted)
  textAt(ctx, 'cân bằng', x0 + 78, y + 16, 11, INK.muted)
  const grain = pts[20]
  const gPhase = (20 / 80) * Math.PI * 4 - time * 2.6
  const up = -Math.cos(gPhase)
  ink(ctx, INK.red)
  arrow(ctx, grain[0], grain[1], grain[0], grain[1] - up * 18)
  textAt(ctx, 'v hạt', grain[0] + 22, grain[1] - up * 10, 11, INK.red)
  textAt(ctx, 'truyền →    dao động ⊥    E ~ A²', w * 0.4, h - 10, 11, INK.text)
}

function drawField(ctx: Ctx, w: number, h: number, kind = 'electric', time = 0, tune?: number[]) {
  if (kind === 'wire') {
    const y = h * 0.58
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 5; col += 1) textAt(ctx, '×', w * 0.24 + col * 32, h * 0.26 + row * 34, 14, INK.violet)
    }
    textAt(ctx, 'B ⊗', w * 0.16, h * 0.18, 13, INK.violet)
    const dir = tuneAt(tune, 0, 1) >= 0 ? 1 : -1
    ink(ctx, INK.blue)
    arrow(ctx, dir > 0 ? w * 0.14 : w * 0.86, y, dir > 0 ? w * 0.86 : w * 0.14, y)
    textAt(ctx, 'I', dir > 0 ? w * 0.9 : w * 0.1, y + 14, 13, INK.blue)
    knob(ctx, w * 0.5, y)
    ink(ctx, INK.red)
    arrow(ctx, w * 0.5, y, w * 0.5, y - dir * 48)
    textAt(ctx, 'F', w * 0.58, y - dir * 36, 13, INK.red)
    const flow = wrap01(time * 0.22)
    ink(ctx, INK.sky)
    for (let i = 0; i < 3; i += 1) {
      const s = wrap01(flow + i / 3)
      const along = dir > 0 ? s : 1 - s
      ctx.beginPath()
      ctx.arc(w * 0.18 + along * w * 0.6, y, 3.2, 0, Math.PI * 2)
      ctx.fill()
    }
    textAt(ctx, 'F = Iℓ × B', w * 0.42, h - 12, 12, INK.red)
    return
  }
  if (kind !== 'magnet') {
    const { x1, y1, x2, y2 } = chargePose(w, h, tune)
    textAt(ctx, '+', x1, y1, 22, INK.red)
    textAt(ctx, '−', x2, y2, 22, INK.blue)
    knob(ctx, x1, y1)
    knob(ctx, x2, y2)
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    const dx = x2 - x1
    const dy = y2 - y1
    const span = Math.hypot(dx, dy) || 1
    const nx = -dy / span
    const ny = dx / span
    ink(ctx, INK.green)
    for (const bend of [-50, -20, 16, 46]) {
      const cpx = mx + nx * bend
      const cpy = my + ny * bend
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.quadraticCurveTo(cpx, cpy, x2, y2)
      ctx.stroke()
      const t = 0.62
      const mt = 1 - t
      const x = mt * mt * x1 + 2 * mt * t * cpx + t * t * x2
      const y = mt * mt * y1 + 2 * mt * t * cpy + t * t * y2
      const t2 = 0.74
      const mt2 = 1 - t2
      const x3 = mt2 * mt2 * x1 + 2 * mt2 * t2 * cpx + t2 * t2 * x2
      const y3 = mt2 * mt2 * y1 + 2 * mt2 * t2 * cpy + t2 * t2 * y2
      arrow(ctx, x, y, x3, y3, 7)
    }
    textAt(ctx, '+q', x1, y1 - 22, 13, INK.red)
    textAt(ctx, '−q', x2, y2 - 22, 13, INK.blue)
    textAt(ctx, 'đường sức', w * 0.5, h * 0.12, 12, INK.green)
    const flow = wrap01(time * 0.18)
    const cpx = mx + nx * -20
    const cpy = my + ny * -20
    const mt = 1 - flow
    const px = mt * mt * x1 + 2 * mt * flow * cpx + flow * flow * x2
    const py = mt * mt * y1 + 2 * mt * flow * cpy + flow * flow * y2
    ink(ctx, INK.red)
    ctx.beginPath()
    ctx.arc(px, py, 5, 0, Math.PI * 2)
    ctx.fill()
    const pull = Math.hypot(x2 - x1, y2 - y1) || 1
    ink(ctx, INK.amber)
    arrow(ctx, x1, y1, x1 + ((x2 - x1) / pull) * 28, y1 + ((y2 - y1) / pull) * 28)
    arrow(ctx, x2, y2, x2 - ((x2 - x1) / pull) * 28, y2 - ((y2 - y1) / pull) * 28)
    textAt(ctx, 'lực hút', w * 0.5, h - 12, 12, INK.amber)
    return
  }
  const xN = clampNum(tuneAt(tune, 0, 0.3), 0.08, 0.52) * w
  const xS = xN + 100
  const y = h * 0.42
  ctx.fillStyle = '#fecaca'
  ctx.fillRect(xN, y, 50, 48)
  ctx.fillStyle = '#bfdbfe'
  ctx.fillRect(xN + 50, y, 50, 48)
  ctx.strokeRect(xN, y, 100, 48)
  knob(ctx, xN + 50, y + 24)
  textAt(ctx, 'N', xN + 25, y + 24, 16, INK.red)
  textAt(ctx, 'S', xN + 75, y + 24, 16, INK.blue)
  ink(ctx, INK.violet)
  const loops: Array<[number, number]> = [[-12, -36], [-4, -62], [12, 44], [20, 70]]
  for (const [dy, bow] of loops) {
    const y0 = y + 24 + dy
    ctx.beginPath()
    ctx.moveTo(xN, y0)
    ctx.bezierCurveTo(xN + bow, y0 + bow, xS - bow, y0 + bow, xS, y0)
    ctx.stroke()
    const midX = (xN + xS) / 2
    const midY = y0 + bow * 0.75
    arrow(ctx, midX - 8, midY, midX + 10, midY, 7)
  }
  textAt(ctx, 'đường sức', xS + 28, y - 8, 12, INK.violet)
  textAt(ctx, 'B', xS + 28, y + 28, 13, INK.violet)
  ink(ctx, INK.amber)
  loops.forEach(([, bow], index) => {
    const y0 = y + 24 + loops[index][0]
    const flow = wrap01(time * 0.16 + index * 0.17)
    const mt = 1 - flow
    const px = mt * mt * mt * xN + 3 * mt * mt * flow * (xN + bow) + 3 * mt * flow * flow * (xS - bow) + flow * flow * flow * xS
    const py = mt * mt * mt * y0 + 3 * mt * mt * flow * (y0 + bow) + 3 * mt * flow * flow * (y0 + bow) + flow * flow * flow * y0
    ctx.beginPath()
    ctx.arc(px, py, 3, 0, Math.PI * 2)
    ctx.fill()
  })
  textAt(ctx, 'B: N → S, cực khác tên hút nhau', w * 0.48, h - 12, 11, INK.violet)
}

function drawLaw(ctx: Ctx, w: number, h: number, kind: string) {
  const x = 46
  const y = h - 40
  if (kind === 'gas') {
    axes(ctx, x, y, w - 20, 24, 'V', 'p')
    const pts: Array<[number, number]> = []
    for (let i = 0; i <= 24; i += 1) {
      const v = 16 + i * 8
      pts.push([x + v, y - 2200 / v])
    }
    ink(ctx, INK.green)
    plotLine(ctx, pts)
    textAt(ctx, 'pV = hằng số', w * 0.62, 32, 12, INK.green)
    return
  }
  if (kind === 'motion') {
    axes(ctx, x, y, w - 20, 24, 't', 's')
    ink(ctx, INK.blue)
    plotLine(ctx, [[x, y], [x + 40, y - 18], [x + 90, y - 55], [x + 150, y - 110], [x + 210, y - 150]])
    textAt(ctx, 'nhanh dần', w * 0.62, 32, 12, INK.blue)
    return
  }
  axes(ctx, x, y, w - 20, 24, 't', 'N')
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= 30; i += 1) {
    const t = i / 30
    pts.push([x + t * (w - 80), y - 120 * Math.exp(-2.2 * t)])
  }
  ink(ctx, INK.amber)
  plotLine(ctx, pts)
  const halfX = x + (Math.LN2 / 2.2) * (w - 80)
  const halfY = y - 60
  ink(ctx, INK.muted)
  ctx.save()
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(x, halfY)
  ctx.lineTo(halfX, halfY)
  ctx.lineTo(halfX, y)
  ctx.stroke()
  ctx.restore()
  textAt(ctx, 'N₀/2', x + 28, halfY - 8, 11, INK.muted)
  textAt(ctx, 'T½', halfX, y + 16, 12, INK.amber)
}

function drawRefraction(ctx: Ctx, w: number, h: number, prism: boolean, tune?: number[], time = 0) {
  if (!prism) {
    const s = snellPose(w, h, tune)
    ctx.fillStyle = '#e0f2fe'
    ctx.fillRect(16, h * 0.48, w - 32, h * 0.42)
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.moveTo(16, h * 0.48)
    ctx.lineTo(w - 16, h * 0.48)
    ctx.stroke()
    textAt(ctx, 'không khí  n₁', w * 0.22, h * 0.28, 13, INK.sky)
    textAt(ctx, 'thuỷ tinh  n₂ > n₁', w * 0.28, h * 0.7, 13, INK.blue)
    const { hx, hy, x1, y1, x2, y2, deg, rDeg } = s
    ink(ctx, INK.muted)
    ctx.save()
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(hx, hy - 70)
    ctx.lineTo(hx, hy + 70)
    ctx.stroke()
    ctx.restore()
    ink(ctx, INK.amber)
    arrow(ctx, x1, y1, hx, hy)
    knob(ctx, x1, y1)
    ink(ctx, INK.blue)
    arrow(ctx, hx, hy, x2, y2)
    textAt(ctx, `i ${Math.round(deg)}°`, hx - 36, hy - 28, 12, INK.amber)
    textAt(ctx, `r ${Math.round(rDeg)}°`, hx + 28, hy + 28, 12, INK.blue)
    textAt(ctx, 'pháp tuyến', hx + 46, hy - 40, 11, INK.muted)
    textAt(ctx, 'n₁ sin i = n₂ sin r', w * 0.62, h - 14, 12, INK.text)
    const hop = wrap01(time * 0.3)
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.arc(x1 + (hx - x1) * hop, y1 + (hy - y1) * hop, 3.2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  const cx = w * 0.48
  const cy = h * 0.55
  ctx.fillStyle = '#e0f2fe'
  ctx.strokeStyle = INK.sky
  poly(ctx, [[cx, cy - 70], [cx + 70, cy + 60], [cx - 70, cy + 60]], true)
  ctx.fill()
  poly(ctx, [[cx, cy - 70], [cx + 70, cy + 60], [cx - 70, cy + 60]], true)
  const inX = cx + (cx - 70 - cx) * 0.42
  const inY = cy - 70 + (cy + 60 - (cy - 70)) * 0.42
  const outX = cx + (cx + 70 - cx) * 0.62
  const outY = cy - 70 + (cy + 60 - (cy - 70)) * 0.62
  ink(ctx, INK.amber)
  arrow(ctx, inX - 78, inY - 16, inX, inY)
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(inX, inY)
  ctx.lineTo(outX, outY)
  ctx.stroke()
  const run = Math.max(24, w - 16 - outX)
  const slope = (outY - inY) / Math.max(8, outX - inX)
  const straight = outY + slope * run
  ctx.strokeStyle = '#dc2626'
  arrow(ctx, outX, outY, w - 16, straight + 10)
  ctx.strokeStyle = '#2563eb'
  arrow(ctx, outX, outY, w - 16, straight + 34)
  ctx.strokeStyle = '#1e293b'
  textAt(ctx, 'đỏ', w - 28, straight + 2, 11, '#dc2626')
  textAt(ctx, 'tím', w - 28, straight + 42, 11, '#2563eb')
  textAt(ctx, 'cả hai lệch về đáy, tím lệch hơn', w * 0.55, h - 12, 11, INK.text)
}

export function waveTankLayout(w: number, h: number, tune?: number[]) {
  const tray = { x: w * 0.018, y: h * 0.075, w: w * 0.71, h: h * 0.89 }
  const panelX = tray.x + tray.w + w * 0.018
  const panelW = Math.max(36, w - panelX - w * 0.014)
  const both = tuneAt(tune, 1, 1) >= 0.5
  const gap = clampNum(tuneAt(tune, 0, 0.2), 0.12, 0.34)
  const midX = tray.x + tray.w * 0.5
  const sy = tray.y + tray.h * 0.4
  const half = tray.w * gap * 0.5
  const lambda = Math.max(14, tray.w * 0.054)
  const chipH = Math.max(20, Math.min(28, h * 0.056))
  const insetH = Math.min(panelW * 0.46, tray.h * 0.18)
  const insetY = tray.y + Math.max(48, h * 0.108)
  const noteY = insetY + insetH + Math.max(18, h * 0.034)
  const oneY = noteY + Math.max(64, h * 0.15)
  const twoY = oneY + chipH + 6
  const watchY = twoY + chipH * 0.5 + Math.max(14, h * 0.03)
  return {
    tray,
    panelX,
    panelW,
    both,
    lambda,
    midX,
    sy,
    chipH,
    insetH,
    insetY,
    noteY,
    oneY,
    twoY,
    watchY,
    s1: { x: midX - half, y: sy },
    s2: { x: midX + half, y: sy },
  }
}

function plate(ctx: Ctx, text: string, x: number, y: number, size: number, color: string) {
  const width = spanWidth(text, size) + 10
  ctx.save()
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.fillRect(x - width / 2, y - size * 0.65, width, size * 1.3)
  ctx.strokeRect(x - width / 2, y - size * 0.65, width, size * 1.3)
  ctx.restore()
  textAt(ctx, text, x, y, size, color)
}

function strokePathGap(ctx: Ctx, midX: number, sy: number, d: number, delta: number, y0: number, y1: number) {
  const c = d / 2
  const a = delta / 2
  if (!(a > 0.6) || a >= c - 0.6) return
  const b = Math.sqrt(c * c - a * a)
  if (b < 0.8) return
  const reach = Math.max(Math.abs(y0 - sy), Math.abs(y1 - sy), 1)
  const tMax = Math.min(2.8, Math.asinh(reach / b))
  const steps = 32
  for (const sign of [-1, 1]) {
    ctx.beginPath()
    for (let i = 0; i <= steps; i += 1) {
      const t = -tMax + (2 * tMax * i) / steps
      const x = midX + sign * a * Math.cosh(t)
      const y = sy + b * Math.sinh(t)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
}

function drawWaveRings(ctx: Ctx, x: number, y: number, phase: number, lambda: number, maxR: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.25, lambda * 0.055)
  const lead = phase * lambda
  for (let i = 0; i < 28; i += 1) {
    const r = lead + i * lambda
    if (r < lambda * 0.35 || r > maxR) continue
    ctx.globalAlpha = 0.28 + 0.62 * (1 - r / maxR)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function drawTankSide(ctx: Ctx, x: number, y: number, w: number, h: number, both: boolean, bob: number) {
  const rim = y + h * 0.46
  const base = y + h - 1
  ink(ctx, '#64748b')
  ctx.lineWidth = 1.4
  ctx.strokeRect(x, rim, w, Math.max(8, base - rim))
  const waterTop = rim + Math.max(4, (base - rim) * 0.42)
  ctx.fillStyle = '#bae6fd'
  ctx.fillRect(x + 1.5, waterTop, Math.max(0, w - 3), Math.max(0, base - waterTop - 1.5))
  textAt(ctx, 'nước nông', x + w * 0.5, (waterTop + base) / 2, 10, INK.sky)
  const railY = y + 12
  const x1 = x + w * 0.34
  const x2 = x + w * 0.68
  ink(ctx, '#44403c')
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x1 - 8, railY)
  ctx.lineTo(x2 + 8, railY)
  ctx.stroke()
  const dip = (px: number, on: boolean, name: string) => {
    const tip = on ? waterTop + bob : railY + 8
    ctx.beginPath()
    ctx.moveTo(px, railY)
    ctx.lineTo(px, tip)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(px, tip, 3.1, 0, Math.PI * 2)
    ctx.fillStyle = on ? '#0284c7' : '#e2e8f0'
    ctx.fill()
    ctx.stroke()
    textAt(ctx, name, px, y + 5, 10, on ? INK.blue : INK.muted)
  }
  dip(x1, true, 'S1')
  dip(x2, both, 'S2')
}

export function youngLayout(w: number, h: number, tune?: number[]) {
  const stage = { x: w * 0.02, y: h * 0.08, w: w * 0.68, h: h * 0.86 }
  const panelX = stage.x + stage.w + w * 0.02
  const panelW = Math.max(36, w - panelX - w * 0.016)
  const midY = stage.y + stage.h * 0.46
  const dFrac = clampNum(tuneAt(tune, 0, 0.18), 0.08, 0.28)
  const along = clampNum(tuneAt(tune, 1, 0.55), 0, 1)
  const slitX = stage.x + stage.w * 0.3
  const minL = stage.w * 0.28
  const maxL = stage.w * 0.52
  const L = minL + (maxL - minL) * along
  const screenX = slitX + L
  const d = Math.max(8, stage.h * dFrac)
  const lambda = Math.max(10, stage.h * 0.038)
  const fringe = lambda * L / d
  const pad = Math.max(8, Math.min(36, stage.h * 0.09))
  const screenTop = stage.y + pad
  const screenH = Math.max(16, stage.h - pad * 2)
  const source = { x: stage.x + Math.min(36, stage.w * 0.08), y: midY }
  return {
    stage,
    panelX,
    panelW,
    midY,
    slitX,
    screenX,
    minL,
    maxL,
    L,
    d,
    lambda,
    fringe,
    screenTop,
    screenH,
    source,
    s1: { x: slitX, y: midY - d / 2 },
    s2: { x: slitX, y: midY + d / 2 },
    slitHandle: { x: slitX - 50, y: midY + d / 2 + 10 },
  }
}

function drawYoungScreen(ctx: Ctx, x: number, top: number, height: number, midY: number, fringe: number) {
  const width = 20
  ctx.fillStyle = '#1e1b4b'
  ctx.fillRect(x, top, width, height)
  const step = 2
  const safe = Math.max(fringe, 1)
  for (let y = top; y < top + height; y += step) {
    const intens = Math.cos(Math.PI * (y + step / 2 - midY) / safe) ** 2
    const r = Math.round(24 + intens * 227)
    const g = Math.round(18 + intens * 171)
    const b = Math.round(70 + intens * 10)
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fillRect(x + 1, y, width - 2, step + 0.5)
  }
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 1.4
  ctx.strokeRect(x, top, width, height)
}

function drawYoung(ctx: Ctx, w: number, h: number, time = 0, tune?: number[]) {
  const scene = youngLayout(w, h, tune)
  const { stage, s1, s2 } = scene
  const spin = Number.isFinite(time) ? time : 0
  const phase = wrap01(spin * 0.32)
  const screenW = 20
  ctx.fillStyle = '#f8fafc'
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.fillRect(scene.panelX - 6, stage.y, scene.panelW + 10, stage.h)
  ctx.strokeRect(scene.panelX - 6, stage.y, scene.panelW + 10, stage.h)
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#cbd5e1'
  ctx.fillRect(stage.x, stage.y, stage.w, stage.h)
  ctx.strokeRect(stage.x, stage.y, stage.w, stage.h)
  ink(ctx, '#cbd5e1')
  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(scene.source.x, scene.midY)
  ctx.lineTo(scene.screenX, scene.midY)
  ctx.stroke()
  ctx.restore()
  ink(ctx, INK.amber)
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(scene.source.x + 8, scene.source.y)
  ctx.lineTo(s1.x - 6, s1.y)
  ctx.moveTo(scene.source.x + 8, scene.source.y)
  ctx.lineTo(s2.x - 6, s2.y)
  ctx.stroke()
  ink(ctx, INK.blue)
  ctx.lineWidth = 1.15
  ctx.beginPath()
  ctx.moveTo(s1.x + 6, s1.y)
  ctx.lineTo(scene.screenX, scene.midY)
  ctx.moveTo(s2.x + 6, s2.y)
  ctx.lineTo(scene.screenX, scene.midY)
  ctx.stroke()
  ctx.save()
  ctx.beginPath()
  ctx.rect(scene.slitX + 8, scene.screenTop, Math.max(0, scene.screenX - scene.slitX - 10), scene.screenH)
  ctx.clip()
  const maxR = scene.L
  for (const src of [s1, s2]) {
    ctx.strokeStyle = src === s1 ? '#0284c7' : '#7c3aed'
    ctx.lineWidth = 1.15
    for (let i = 0; i < 10; i += 1) {
      const r = (phase + i) * scene.lambda * 1.35
      if (r < 8 || r > maxR) continue
      ctx.globalAlpha = 0.18 + 0.28 * (1 - r / maxR)
      ctx.beginPath()
      ctx.arc(src.x, src.y, r, -1.15, 1.15)
      ctx.stroke()
    }
  }
  ctx.restore()
  const wallTop = scene.screenTop
  const wallBot = scene.screenTop + scene.screenH
  const gap = 6
  ctx.fillStyle = '#334155'
  const bands: Array<[number, number]> = [
    [wallTop, s1.y - gap],
    [s1.y + gap, s2.y - gap],
    [s2.y + gap, wallBot],
  ]
  for (const [a, b] of bands) {
    if (b - a > 2) ctx.fillRect(scene.slitX - 6, a, 12, b - a)
  }
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1.2
  ctx.strokeRect(scene.slitX - 6, wallTop, 12, Math.max(0, wallBot - wallTop))
  ctx.fillStyle = '#fef3c7'
  ctx.strokeStyle = INK.amber
  ctx.lineWidth = 1.6
  ctx.fillRect(scene.source.x - 11, scene.source.y - 11, 22, 22)
  ctx.strokeRect(scene.source.x - 11, scene.source.y - 11, 22, 22)
  textAt(ctx, 'S', scene.source.x, scene.source.y + 24, 13, INK.amber)
  drawYoungScreen(ctx, scene.screenX, scene.screenTop, scene.screenH, scene.midY, scene.fringe)
  const hop = wrap01(spin * 0.45)
  ink(ctx, INK.amber)
  const travel = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath()
    ctx.arc(x1 + (x2 - x1) * hop, y1 + (y2 - y1) * hop, 3.2, 0, Math.PI * 2)
    ctx.fill()
  }
  travel(scene.source.x + 10, scene.source.y, s1.x, s1.y)
  travel(scene.source.x + 10, scene.source.y, s2.x, s2.y)
  travel(s1.x, s1.y, scene.screenX, scene.midY)
  travel(s2.x, s2.y, scene.screenX, scene.midY)
  plate(ctx, 'S1', s1.x - 24, s1.y - 18, 12, INK.blue)
  plate(ctx, 'S2', s2.x - 24, s2.y + 18, 12, INK.violet)
  plate(ctx, 'M', scene.screenX + screenW / 2, scene.screenTop - 12, 12, INK.text)
  plate(ctx, 'O', scene.screenX + screenW + 40, scene.midY, 12, INK.amber)
  ink(ctx, INK.green)
  ctx.lineWidth = 1.2
  const iTop = scene.midY - scene.fringe
  if (iTop > scene.screenTop + 8 && scene.fringe < scene.screenH * 0.48) {
    const ix = scene.screenX + screenW + 8
    ctx.beginPath()
    ctx.moveTo(ix, scene.midY)
    ctx.lineTo(ix, iTop)
    ctx.moveTo(ix - 4, scene.midY)
    ctx.lineTo(ix + 4, scene.midY)
    ctx.moveTo(ix - 4, iTop)
    ctx.lineTo(ix + 4, iTop)
    ctx.stroke()
    plate(ctx, 'i', ix + 14, (scene.midY + iTop) / 2, 12, INK.green)
  }
  ink(ctx, INK.violet)
  ctx.lineWidth = 1.15
  const dx = scene.slitX + 18
  ctx.beginPath()
  ctx.moveTo(dx, s1.y)
  ctx.lineTo(dx, s2.y)
  ctx.moveTo(dx - 4, s1.y)
  ctx.lineTo(dx + 4, s1.y)
  ctx.moveTo(dx - 4, s2.y)
  ctx.lineTo(dx + 4, s2.y)
  ctx.stroke()
  plate(ctx, 'd', dx + 8, s1.y - 22, 12, INK.violet)
  const baseY = stage.y + stage.h - 18
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(scene.slitX, baseY)
  ctx.lineTo(scene.screenX, baseY)
  ctx.moveTo(scene.slitX, baseY - 4)
  ctx.lineTo(scene.slitX, baseY + 4)
  ctx.moveTo(scene.screenX, baseY - 4)
  ctx.lineTo(scene.screenX, baseY + 4)
  ctx.stroke()
  plate(ctx, 'L', (scene.slitX + scene.screenX) / 2, baseY - 12, 12, INK.blue)
  plate(ctx, 'y', scene.screenX - 28, scene.screenTop - 2, 12, INK.green)
  knob(ctx, scene.slitHandle.x, scene.slitHandle.y)
  knob(ctx, scene.screenX + screenW / 2, scene.screenTop + scene.screenH - 10)
  textAt(ctx, 'Thí nghiệm Young', stage.x + 78, Math.max(14, stage.y * 0.42), 13, INK.text)
  const px = scene.panelX + scene.panelW / 2
  const top = stage.y
  textAt(ctx, 'Tạo 2 nguồn kết hợp', px, top + 14, 12, INK.text)
  textAt(ctx, 'Nguồn S chiếu qua hai khe', px, top + 32, 11, INK.text)
  textAt(ctx, 'S1, S2 cùng pha', px, top + 48, 11, INK.sky)
  ctx.fillStyle = '#fff7ed'
  ctx.strokeStyle = '#fdba74'
  ctx.lineWidth = 1.2
  ctx.fillRect(scene.panelX, top + 62, scene.panelW, 48)
  ctx.strokeRect(scene.panelX, top + 62, scene.panelW, 48)
  richLine(ctx, [
    { text: 'i', color: INK.green },
    { text: ' = ', color: INK.muted },
    { text: 'λL', color: INK.blue },
    { text: ' / ', color: INK.muted },
    { text: 'd', color: INK.violet },
  ], px, top + 80, 18)
  textAt(ctx, 'khoảng vân', px, top + 98, 11, INK.amber)
  textAt(ctx, 'Kéo S2 để đổi d', px, top + 126, 11, INK.violet)
  textAt(ctx, 'Kéo màn M để đổi L', px, top + 142, 11, INK.blue)
  textAt(ctx, 'Trên màn: vân sáng, vân tối', px, top + 166, 11, INK.text)
  textAt(ctx, 'i là hai vân sáng liền kề', px, top + 182, 11, INK.green)
  const ratio = scene.L / scene.d
  textAt(ctx, `i = ${ratio.toFixed(1).replace('.', ',')} λ`, px, top + 204, 13, INK.amber)
  textAt(ctx, 'd tăng thì i giảm', px, top + 224, 11, INK.violet)
  textAt(ctx, 'L tăng thì i tăng', px, top + 240, 11, INK.blue)
  const gy = top + 268
  const gx = scene.panelX + 16
  const gw = Math.max(20, scene.panelW - 32)
  if (gy + 52 < stage.y + stage.h - 28) {
    ink(ctx, INK.muted)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(gx, gy + 36)
    ctx.lineTo(gx + gw, gy + 36)
    ctx.stroke()
    const pts: Array<[number, number]> = []
    for (let i = 0; i <= 48; i += 1) {
      const t = i / 48
      pts.push([gx + t * gw, gy + 36 - Math.cos(Math.PI * (t * 4 - 2)) ** 2 * 18])
    }
    ink(ctx, INK.amber)
    ctx.lineWidth = 1.6
    plotLine(ctx, pts)
    textAt(ctx, 'sáng', gx + gw * 0.12, gy + 4, 10, INK.amber)
    textAt(ctx, 'tối', gx + gw * 0.37, gy + 4, 10, INK.muted)
  }
  textAt(ctx, 'Đo bước sóng, đo kích thước nhỏ', px, stage.y + stage.h - 14, 11, INK.muted)
}

function drawInterfere(ctx: Ctx, w: number, h: number, time = 0, tune?: number[]) {
  const scene = waveTankLayout(w, h, tune)
  const { tray, s1, s2 } = scene
  const spin = Number.isFinite(time) ? time : 0
  const phase = wrap01(spin * 0.32)
  const bob = Math.sin(spin * 2.1) * Math.min(5, tray.h * 0.012)
  const size = w < 560 ? 10 : 12
  ctx.fillStyle = '#f8fafc'
  ctx.strokeStyle = '#e2e8f0'
  ctx.lineWidth = 1
  ctx.fillRect(scene.panelX - 6, tray.y, scene.panelW + 10, tray.h)
  ctx.strokeRect(scene.panelX - 6, tray.y, scene.panelW + 10, tray.h)
  ctx.fillStyle = '#e0f2fe'
  ctx.fillRect(tray.x, tray.y, tray.w, tray.h)
  const maxR = Math.hypot(tray.w, tray.h)
  ctx.save()
  ctx.beginPath()
  ctx.rect(tray.x + 2, tray.y + 2, Math.max(0, tray.w - 4), Math.max(0, tray.h - 4))
  ctx.clip()
  drawWaveRings(ctx, s1.x, s1.y, phase, scene.lambda, maxR, '#0284c7')
  if (scene.both) drawWaveRings(ctx, s2.x, s2.y, phase, scene.lambda, maxR, '#2563eb')
  if (scene.both) {
    const d = Math.max(1, s2.x - s1.x)
    const y0 = tray.y + 4
    const y1 = tray.y + tray.h - 4
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(248,250,252,0.8)'
    ctx.lineWidth = Math.max(3, scene.lambda * 0.2)
    for (let n = 0; n < 8; n += 1) {
      const delta = (n + 0.5) * scene.lambda
      if (delta >= d - 1) break
      strokePathGap(ctx, scene.midX, scene.sy, d, delta, y0, y1)
    }
    ctx.strokeStyle = '#d97706'
    ctx.lineWidth = 1.15
    ctx.setLineDash([4, 4])
    for (let n = 0; n < 8; n += 1) {
      const delta = (n + 0.5) * scene.lambda
      if (delta >= d - 1) break
      strokePathGap(ctx, scene.midX, scene.sy, d, delta, y0, y1)
    }
    ctx.strokeStyle = '#059669'
    for (let n = 1; n < 8; n += 1) {
      const delta = n * scene.lambda
      if (delta >= d - 1) break
      strokePathGap(ctx, scene.midX, scene.sy, d, delta, y0, y1)
    }
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(scene.midX, y0)
    ctx.lineTo(scene.midX, y1)
    ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
  ink(ctx, '#475569')
  ctx.lineWidth = 3
  ctx.strokeRect(tray.x, tray.y, tray.w, tray.h)
  ctx.lineWidth = 1.25
  ctx.strokeRect(tray.x + 6, tray.y + 6, Math.max(0, tray.w - 12), Math.max(0, tray.h - 12))
  const railY = Math.max(tray.y + 26, scene.sy - Math.max(34, tray.h * 0.1))
  ink(ctx, '#44403c')
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(s1.x - 16, railY)
  ctx.lineTo(s2.x + 16, railY)
  ctx.stroke()
  ctx.fillStyle = '#f5f5f4'
  ctx.strokeStyle = '#44403c'
  ctx.lineWidth = 1.4
  ctx.fillRect(scene.midX - 14, railY - 13, 28, 16)
  ctx.strokeRect(scene.midX - 14, railY - 13, 28, 16)
  textAt(ctx, 'f', scene.midX, railY - 5, 11, INK.text)
  textAt(ctx, 'Giao thoa sóng nước', tray.x + 78, Math.max(14, tray.y * 0.45), 13, INK.text)
  const rod = (x: number, live: boolean) => {
    const tip = scene.sy + (live ? bob : 0)
    ink(ctx, live ? '#44403c' : '#94a3b8')
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(x, railY)
    ctx.lineTo(x, tip)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, tip, 5.5, 0, Math.PI * 2)
    ctx.fillStyle = live ? '#e0f2fe' : '#f8fafc'
    ctx.fill()
    ctx.stroke()
  }
  rod(s1.x, true)
  rod(s2.x, scene.both)
  ink(ctx, INK.amber)
  ctx.lineWidth = 1.2
  const dimY = scene.sy + 26
  ctx.beginPath()
  ctx.moveTo(s1.x, dimY)
  ctx.lineTo(s2.x, dimY)
  ctx.moveTo(s1.x, dimY - 4)
  ctx.lineTo(s1.x, dimY + 4)
  ctx.moveTo(s2.x, dimY - 4)
  ctx.lineTo(s2.x, dimY + 4)
  ctx.stroke()
  plate(ctx, 'd', scene.midX, dimY + 12, 11, INK.amber)
  plate(ctx, 'S1', s1.x - 22, scene.sy - 16, 12, INK.blue)
  plate(ctx, scene.both ? 'S2' : 'S2 tắt', s2.x + 26, scene.sy - 16, 12, scene.both ? INK.blue : INK.muted)
  plate(ctx, 'khay nước nông', tray.x + 62, tray.y + tray.h - 16, 11, INK.muted)
  knob(ctx, s2.x, s2.y)
  const markY = Math.min(tray.y + tray.h - 36, scene.sy + scene.lambda * 2.3)
  if (scene.both) {
    plate(ctx, 'gợn cao', scene.midX + 34, markY, 11, INK.green)
    let nodeX = s2.x + scene.lambda
    let best = Number.POSITIVE_INFINITY
    const y = markY + 22
    for (let x = scene.midX + 6; x < tray.x + tray.w - 24; x += 3) {
      const gap = Math.abs(Math.hypot(x - s1.x, y - s1.y) - Math.hypot(x - s2.x, y - s2.y))
      const err = Math.abs(gap - scene.lambda * 0.5)
      if (err < best) {
        best = err
        nodeX = x
      }
    }
    if (best < scene.lambda * 0.2) plate(ctx, 'đứng yên', nodeX, y + 16, 11, INK.amber)
  } else {
    plate(ctx, 'vòng tròn đồng tâm', scene.midX, tray.y + tray.h - 42, 11, INK.sky)
  }
  const px = scene.panelX + scene.panelW / 2
  textAt(ctx, 'Bố trí thí nghiệm', px, tray.y + 10, size, INK.text)
  textAt(ctx, 'nhìn ngang', px, tray.y + 30, 10, INK.muted)
  drawTankSide(ctx, scene.panelX, scene.insetY, scene.panelW, scene.insetH, scene.both, bob * 0.45)
  textAt(ctx, 'Hai đầu rung trên mặt nước', px, scene.noteY, 11, INK.text)
  textAt(ctx, 'S1, S2 gần nhau', px, scene.noteY + 14, 11, INK.text)
  textAt(ctx, 'Cùng tần số, cùng pha', px, scene.noteY + 28, 11, INK.sky)
  const chip = (y: number, label: string, on: boolean) => {
    ctx.save()
    ctx.fillStyle = on ? '#e0f2fe' : '#ffffff'
    ctx.strokeStyle = on ? INK.sky : '#cbd5e1'
    ctx.lineWidth = on ? 2 : 1
    ctx.fillRect(scene.panelX, y - scene.chipH / 2, scene.panelW, scene.chipH)
    ctx.strokeRect(scene.panelX, y - scene.chipH / 2, scene.panelW, scene.chipH)
    ctx.restore()
    textAt(ctx, label, px, y, 12, on ? INK.sky : INK.muted)
  }
  chip(scene.oneY, 'Một nguồn S1', !scene.both)
  chip(scene.twoY, 'Hai nguồn S1, S2', scene.both)
  textAt(ctx, 'Quan sát', px, scene.watchY, 11, INK.muted)
  if (scene.both) {
    textAt(ctx, 'Hai nguồn chồng chất', px, scene.watchY + 16, 11, INK.text)
    textAt(ctx, 'Xanh: gợn sóng cao', px, scene.watchY + 32, 11, INK.green)
    textAt(ctx, 'Cam: gần như đứng yên', px, scene.watchY + 48, 11, INK.amber)
  } else {
    textAt(ctx, 'Chỉ S1 hoạt động', px, scene.watchY + 16, 11, INK.text)
    textAt(ctx, 'Vòng tròn đồng tâm', px, scene.watchY + 32, 11, INK.sky)
  }
  const ratio = (s2.x - s1.x) / scene.lambda
  const ratioY = scene.watchY + (scene.both ? 68 : 52)
  textAt(ctx, `d = ${ratio.toFixed(1).replace('.', ',')} λ`, px, ratioY, 12, INK.amber)
  const keyY = ratioY + 22
  ink(ctx, INK.sky)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(scene.panelX + 10, keyY)
  ctx.lineTo(scene.panelX + 10 + scene.lambda, keyY)
  ctx.moveTo(scene.panelX + 10, keyY - 4)
  ctx.lineTo(scene.panelX + 10, keyY + 4)
  ctx.moveTo(scene.panelX + 10 + scene.lambda, keyY - 4)
  ctx.lineTo(scene.panelX + 10 + scene.lambda, keyY + 4)
  ctx.stroke()
  textAt(ctx, 'λ', scene.panelX + 18 + scene.lambda, keyY, 12, INK.sky)
  textAt(ctx, 'Kéo núm S2 để đổi d', px, tray.y + tray.h - 14, 11, INK.muted)
}

function drawExperiment(ctx: Ctx, w: number, h: number, kind = 'projectile', time = 0, tune?: number[]) {
  if (kind === 'spring') {
    const cx = w * 0.46
    const top = 22
    const rest = h * 0.58
    const eq = springShift(rest, 16 / 240, h, tune, time)
    stand(ctx, w * 0.7, h)
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.moveTo(w * 0.2, top)
    ctx.lineTo(cx + 50, top)
    ctx.moveTo(cx, top)
    ctx.lineTo(cx, top + 12)
    ctx.stroke()
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.moveTo(cx, top + 12)
    for (let i = 1; i <= 7; i += 1) {
      const yy = top + 12 + ((eq - 40 - top) * i) / 7
      ctx.lineTo(cx + (i % 2 === 0 ? 12 : -12), yy)
    }
    ctx.lineTo(cx, eq - 28)
    ctx.stroke()
    ctx.fillStyle = '#e0f2fe'
    ctx.strokeStyle = INK.sky
    ctx.fillRect(cx - 18, eq - 28, 36, 30)
    ctx.strokeRect(cx - 18, eq - 28, 36, 30)
    textAt(ctx, 'm', cx, eq - 13, 12, INK.blue)
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.moveTo(cx + 48, top + 20)
    ctx.lineTo(cx + 48, h - 24)
    ctx.stroke()
    for (let i = 0; i < 6; i += 1) {
      const yy = top + 28 + i * 22
      ctx.beginPath()
      ctx.moveTo(cx + 48, yy)
      ctx.lineTo(cx + 58, yy)
      ctx.stroke()
    }
    textAt(ctx, 'thước', cx + 78, h * 0.4, 12, INK.amber)
    textAt(ctx, 'A biên độ', cx - 36, h - 16, 12, INK.green)
    knob(ctx, cx, eq - 13)
    springDetail(ctx, w, h, cx, rest, eq, 16 / 240, tune)
    return
  }
  if (kind === 'fall') {
    const ground = h - 26
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.moveTo(20, ground)
    ctx.lineTo(w - 16, ground)
    ctx.stroke()
    const drops: Array<[number, number, number, string]> = [
      [w * 0.28, 40, 16, 'v ≈ 0'],
      [w * 0.5, h * 0.4, 34, 'v'],
      [w * 0.72, h * 0.68, 52, 'v lớn'],
    ]
    ctx.save()
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(drops[0][0], drops[0][1])
    ctx.lineTo(drops[0][0], ground)
    ctx.stroke()
    ctx.restore()
    textAt(ctx, 'h', drops[0][0] - 14, h * 0.45, 12, INK.muted)
    drops.forEach(([x, y, len, label]) => {
      ink(ctx, INK.amber)
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#fef3c7'
      ctx.fill()
      ctx.stroke()
      ink(ctx, INK.green)
      arrow(ctx, x + 14, y, x + 14, y + len)
      textAt(ctx, label, x + 36, y + len * 0.4, 11, INK.green)
    })
    textAt(ctx, 'g', w * 0.16, h * 0.3, 13, INK.violet)
    const start = clampNum(tuneAt(tune, 0, 36 / 240), 0.08, 0.62) * h
    knob(ctx, w * 0.5, start)
    const phase = wrap01(time * 0.42)
    const room = Math.max(12, ground - 16 - start)
    const by = start + phase * phase * room
    ink(ctx, INK.red)
    ctx.beginPath()
    ctx.arc(w * 0.5, by, 8, 0, Math.PI * 2)
    ctx.fillStyle = '#fecaca'
    ctx.fill()
    ctx.stroke()
    const dropped = Math.max(0, by - start)
    const kinetic = dropped / room
    energySplit(ctx, 16, 28, 72, kinetic, 1 - kinetic)
    ink(ctx, INK.violet)
    arrow(ctx, w * 0.5 + 16, by, w * 0.5 + 16, by + 22)
    textAt(ctx, 'mg', w * 0.5 + 32, by + 14, 11, INK.violet)
    ink(ctx, INK.green)
    const vLen = 10 + phase * 36
    arrow(ctx, w * 0.5 - 16, by, w * 0.5 - 16, by + vLen)
    textAt(ctx, 'v', w * 0.5 - 28, by + vLen * 0.5, 11, INK.green)
    textAt(ctx, kinetic < 0.04 ? 'thả: v = 0, U cực đại' : 's = ½gt², v tăng dần', w * 0.72, h - 12, 11, INK.text)
    textAt(ctx, 'bỏ qua sức cản', w * 0.22, h - 12, 11, INK.muted)
    return
  }
  if (kind !== 'pendulum') {
    const shot = projectilePose(w, h, tune, time)
    const y = shot.ground
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.moveTo(20, y)
    ctx.lineTo(w - 16, y)
    ctx.stroke()
    ink(ctx, INK.blue)
    ctx.save()
    ctx.beginPath()
    ctx.rect(2, 2, w - 4, h - 4)
    ctx.clip()
    ctx.setLineDash([5, 4])
    plotLine(ctx, shot.pts)
    ctx.restore()
    const p = shot.pts[Math.min(7, Math.max(0, shot.pts.length - 1))]
    const ball = shot.ball
    if (!p || !ball) return
    ink(ctx, INK.green)
    arrow(ctx, p[0], p[1], p[0] + 34, p[1])
    textAt(ctx, 'vₓ', p[0] + 26, p[1] + 12, 12, INK.green)
    ink(ctx, INK.red)
    arrow(ctx, p[0], p[1], p[0], p[1] - 26)
    textAt(ctx, 'vᵧ', p[0] + 16, p[1] - 18, 12, INK.red)
    ink(ctx, INK.amber)
    arrow(ctx, shot.x0, y, shot.hx, shot.hy)
    knob(ctx, shot.hx, shot.hy)
    textAt(ctx, 'α', shot.x0 + 18, y - 28, 13, INK.amber)
    textAt(ctx, 'quỹ đạo', w * 0.62, y - 78, 12, INK.blue)
    textAt(ctx, 'vₓ không đổi, vᵧ đổi chiều', w * 0.58, h - 12, 11, INK.text)
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.arc(ball[0], ball[1], 6, 0, Math.PI * 2)
    ctx.fillStyle = '#fef3c7'
    ctx.fill()
    ctx.stroke()
    const vyNow = shot.vy - shot.g * shot.flight
    const height = Math.max(0, y - ball[1])
    const total = shot.vx * shot.vx + shot.vy * shot.vy
    const potential = Math.min(total, 2 * shot.g * height)
    const kinetic = Math.max(0, total - potential)
    energySplit(ctx, 16, 18, 78, kinetic, potential)
    ink(ctx, INK.violet)
    arrow(ctx, ball[0] + 14, ball[1], ball[0] + 14, ball[1] + 26)
    textAt(ctx, 'mg', ball[0] + 28, ball[1] + 18, 11, INK.violet)
    ink(ctx, INK.green)
    arrow(ctx, ball[0], ball[1] + 12, ball[0] + 22, ball[1] + 12)
    textAt(ctx, 'vx', ball[0] + 16, ball[1] + 24, 10, INK.green)
    if (Math.abs(vyNow) > 8) {
      ink(ctx, INK.blue)
      const tip = ball[1] - Math.sign(vyNow) * 20
      arrow(ctx, ball[0] - 12, ball[1], ball[0] - 12, tip)
      textAt(ctx, 'vy', ball[0] - 24, (ball[1] + tip) / 2, 10, INK.blue)
    }
    return
  }
  const pose = pendulumPose(w, h, tune, time)
  const { x, y, bx, by } = pose
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(w * 0.3, y)
  ctx.lineTo(w * 0.86, y)
  ctx.stroke()
  ctx.save()
  ctx.setLineDash([4, 3])
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + 130)
  ctx.stroke()
  ctx.restore()
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(bx, by)
  ctx.stroke()
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.arc(bx, by, 12, 0, Math.PI * 2)
  ctx.fillStyle = '#fef3c7'
  ctx.fill()
  ctx.stroke()
  knob(ctx, bx, by)
  textAt(ctx, 'θ', x - 18, y + 36, 14, INK.green)
  textAt(ctx, 'l', x + 16, y + 70, 13, INK.blue)
  textAt(ctx, 'vị trí cân bằng', x + 52, y + 108, 11, INK.muted)
  textAt(ctx, 'm', bx - 22, by + 16, 12, INK.amber)
  ink(ctx, INK.violet)
  arrow(ctx, bx, by + 14, bx, by + 46)
  textAt(ctx, 'mg', bx + 16, by + 40, 11, INK.violet)
  const len = pose.len || 1
  ink(ctx, INK.blue)
  arrow(ctx, bx, by, bx + ((x - bx) / len) * 34, by + ((y - by) / len) * 34)
  textAt(ctx, 'T', bx + ((x - bx) / len) * 42, by + ((y - by) / len) * 42, 11, INK.blue)
  if (Math.abs(pose.swing) > 0.08) {
    const dir = -Math.sign(pose.swing)
    const tx = Math.cos(pose.swing) * dir
    const ty = -Math.sin(pose.swing) * dir
    ink(ctx, INK.amber)
    arrow(ctx, bx, by, bx + tx * 30, by + ty * 30)
    textAt(ctx, 'mg sinθ', bx + tx * 44, by + ty * 44, 10, INK.amber)
  }
  const amp = clampNum(tuneAt(tune, 0, -0.46), -1.15, 1.15)
  const span = Math.max(0.04, 1 - Math.cos(amp))
  const potential = clampNum((1 - Math.cos(pose.swing)) / span, 0, 1)
  energySplit(ctx, 16, h - 18, 78, 1 - potential, potential)
  const held = tuneAt(tune, 2, 0) > 0.5
  const speed = held ? 0 : -amp * Math.sin((time - tuneAt(tune, 1, 0)) * 2.1)
  if (Math.abs(speed) > 0.08) {
    const tx = Math.cos(pose.swing) * Math.sign(speed)
    const ty = -Math.sin(pose.swing) * Math.sign(speed)
    ink(ctx, INK.green)
    arrow(ctx, bx - tx * 8, by - ty * 8, bx + tx * 22, by + ty * 22)
    textAt(ctx, 'v', bx + tx * 30, by + ty * 30, 11, INK.green)
  } else {
    textAt(ctx, 'v = 0', 36, h - 30, 11, INK.muted)
  }
}

function drawConstants(ctx: Ctx, w: number, h: number) {
  const rows = ['g = 9,8 m/s²', 'c = 3,00×10⁸ m/s', 'h = 6,63×10⁻³⁴ J·s', 'e = 1,60×10⁻¹⁹ C', 'Nₐ = 6,02×10²³ mol⁻¹', 'R = 8,31 J/(mol·K)']
  rows.forEach((row, i) => {
    const eq = row.indexOf('=')
    richLine(ctx, [
      { text: row.slice(0, eq).trim(), color: INK.blue },
      { text: ' = ', color: INK.muted },
      { text: row.slice(eq + 1).trim(), color: INK.amber },
    ], w / 2, 28 + i * 24, 15)
  })
}

function countFormula(formula: string): Record<string, number> | null {
  let i = 0
  const readNum = () => {
    let s = ''
    while (i < formula.length && formula[i] >= '0' && formula[i] <= '9') {
      s += formula[i]
      i += 1
    }
    return s ? Number(s) : 1
  }
  const parseGroup = (): Record<string, number> | null => {
    const counts: Record<string, number> = {}
    const add = (src: Record<string, number>, n: number) => {
      for (const [key, value] of Object.entries(src)) counts[key] = (counts[key] ?? 0) + value * n
    }
    while (i < formula.length && formula[i] !== ')') {
      const ch = formula[i]
      if (ch === '(') {
        i += 1
        const inner = parseGroup()
        if (!inner || formula[i] !== ')') return null
        i += 1
        add(inner, readNum())
        continue
      }
      if (!ch || ch < 'A' || ch > 'Z') return null
      let el = ch
      i += 1
      if (i < formula.length && formula[i] >= 'a' && formula[i] <= 'z') {
        el += formula[i]
        i += 1
      }
      counts[el] = (counts[el] ?? 0) + readNum()
    }
    return counts
  }
  const counts = parseGroup()
  if (!counts || i !== formula.length) return null
  return counts
}

type Term = { formula: string; counts: Record<string, number> }

function parseSide(raw: string): Term[] | null {
  const parts = raw.split('+').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0) return null
  const out: Term[] = []
  for (const part of parts) {
    const match = /^(\d+)?([A-Z][A-Za-z0-9()]*)$/.exec(part.replace(/\s/g, ''))
    if (!match) return null
    const counts = countFormula(match[2])
    if (!counts) return null
    out.push({ formula: match[2], counts })
  }
  return out
}

/** Cân bằng hệ số nguyên nhỏ. Trả về phương trình hoặc null nếu không cân được. */
export function balanceEquation(raw: string): string | null {
  const text = raw.replace(/→/g, '->').replace(/=/g, '->').trim()
  const sides = text.split('->')
  if (sides.length !== 2) return null
  const left = parseSide(sides[0])
  const right = parseSide(sides[1])
  if (!left || !right) return null
  const species = [...left, ...right]
  if (species.length < 2 || species.length > 5) return null
  const elements = new Set<string>()
  for (const term of species) for (const key of Object.keys(term.counts)) elements.add(key)
  const coeff = new Array<number>(species.length).fill(1)
  let best: number[] | null = null
  let bestSum = Infinity
  const rightAt = left.length
  const walk = (index: number) => {
    if (index === species.length) {
      for (const el of elements) {
        let sumL = 0
        let sumR = 0
        for (let k = 0; k < species.length; k += 1) {
          const amount = (species[k].counts[el] ?? 0) * coeff[k]
          if (k < rightAt) sumL += amount
          else sumR += amount
        }
        if (sumL !== sumR) return
      }
      const sum = coeff.reduce((total, value) => total + value, 0)
      if (sum < bestSum) {
        bestSum = sum
        best = coeff.slice()
      }
      return
    }
    for (let value = 1; value <= 6; value += 1) {
      coeff[index] = value
      walk(index + 1)
    }
  }
  walk(0)
  if (!best) return null
  const format = (terms: Term[], offset: number) => terms.map((term, index) => {
    const value = best?.[offset + index] ?? 1
    return `${value === 1 ? '' : value}${term.formula}`
  }).join(' + ')
  return `${format(left, 0)} → ${format(right, left.length)}`
}

function drawEquation(ctx: Ctx, w: number, h: number, raw: string) {
  const balanced = balanceEquation(raw)
  const text = balanced ?? (raw.trim() || 'H2 + O2 -> H2O')
  const arrow = text.includes('→') ? '→' : text.includes('->') ? '->' : ''
  const note = balanced ? 'đã cân bằng' : 'chưa cân được'
  if (!arrow) {
    cardFormula(ctx, w, h, text, note)
    return
  }
  const [left, right] = text.split(arrow)
  cardFormula(ctx, w, h, [
    { text: `${left.trim()} `, color: INK.blue },
    { text: arrow, color: INK.amber },
    { text: ` ${right.trim()}`, color: INK.green },
  ], note)
}

function bond(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, pairs = 1) {
  ink(ctx, INK.muted)
  const ang = Math.atan2(y2 - y1, x2 - x1)
  const nx = Math.cos(ang + Math.PI / 2)
  const ny = Math.sin(ang + Math.PI / 2)
  for (let i = 0; i < pairs; i += 1) {
    const shift = (i - (pairs - 1) / 2) * 4
    ctx.beginPath()
    ctx.moveTo(x1 + nx * shift, y1 + ny * shift)
    ctx.lineTo(x2 + nx * shift, y2 + ny * shift)
    ctx.stroke()
  }
}

function atomDot(ctx: Ctx, x: number, y: number, symbol: string) {
  const color = symbol === 'O' ? INK.red : symbol === 'H' ? INK.sky : symbol === 'C' ? INK.text : INK.blue
  ink(ctx, color)
  ctx.beginPath()
  ctx.arc(x, y, 16, 0, Math.PI * 2)
  ctx.stroke()
  textAt(ctx, symbol, x, y, 13, color)
}

function drawStructure(ctx: Ctx, w: number, h: number, kind: string) {
  const cx = w / 2
  const cy = h / 2
  if (kind === 'methane') {
    atomDot(ctx, cx, cy, 'C')
    for (const [dx, dy] of [[0, -52], [50, 16], [-50, 16], [0, 52]] as Array<[number, number]>) {
      bond(ctx, cx, cy, cx + dx * 0.55, cy + dy * 0.55)
      atomDot(ctx, cx + dx, cy + dy, 'H')
    }
    return
  }
  if (kind === 'co2') {
    atomDot(ctx, cx - 70, cy, 'O')
    atomDot(ctx, cx, cy, 'C')
    atomDot(ctx, cx + 70, cy, 'O')
    bond(ctx, cx - 54, cy, cx - 16, cy, 2)
    bond(ctx, cx + 16, cy, cx + 54, cy, 2)
    return
  }
  if (kind === 'ethanol') {
    const y = h * 0.52
    const c1 = 86
    const c2 = 150
    const o = 206
    atomDot(ctx, c1, y, 'C')
    atomDot(ctx, c2, y, 'C')
    atomDot(ctx, o, y, 'O')
    atomDot(ctx, c1 - 42, y, 'H')
    atomDot(ctx, c1, y - 42, 'H')
    atomDot(ctx, c1, y + 42, 'H')
    atomDot(ctx, c2, y - 42, 'H')
    atomDot(ctx, c2, y + 42, 'H')
    atomDot(ctx, o + 40, y - 22, 'H')
    bond(ctx, c1 - 26, y, c1 - 16, y)
    bond(ctx, c1, y - 16, c1, y - 26)
    bond(ctx, c1, y + 16, c1, y + 26)
    bond(ctx, c1 + 16, y, c2 - 16, y)
    bond(ctx, c2, y - 16, c2, y - 26)
    bond(ctx, c2, y + 16, c2, y + 26)
    bond(ctx, c2 + 16, y, o - 16, y)
    bond(ctx, o + 10, y - 10, o + 26, y - 16)
    return
  }
  atomDot(ctx, cx, cy - 8, 'O')
  atomDot(ctx, cx - 56, cy + 36, 'H')
  atomDot(ctx, cx + 56, cy + 36, 'H')
  bond(ctx, cx - 10, cy + 4, cx - 42, cy + 28)
  bond(ctx, cx + 10, cy + 4, cx + 42, cy + 28)
}

function vessel(ctx: Ctx, level: number, color: string, trace: () => void, top: number, bottom: number) {
  ctx.save()
  ctx.beginPath()
  trace()
  ctx.clip()
  const y = bottom - ((Math.max(0, Math.min(100, level)) / 100) * (bottom - top))
  ctx.fillStyle = color || '#7dd3fc'
  ctx.fillRect(-20, y, 2000, bottom - y + 30)
  ctx.restore()
  ctx.save()
  ctx.beginPath()
  ctx.strokeStyle = INK.sky
  ctx.lineWidth = 2.2
  trace()
  ctx.stroke()
  ctx.restore()
}

function flaskPath(ctx: Ctx, w: number, h: number) {
  const cx = w * 0.5
  const r = Math.min(w, h) * 0.28
  const cy = h * 0.62
  const n = r * 0.34
  const dy = Math.sqrt(Math.max(1, r * r - n * n))
  const top = h * 0.08
  ctx.moveTo(cx - n, top)
  ctx.lineTo(cx - n, cy - dy)
  ctx.arc(cx, cy, r, Math.atan2(-dy, -n), Math.atan2(-dy, n), true)
  ctx.lineTo(cx + n, top)
  ctx.closePath()
}

function lampJar(ctx: Ctx, w: number, h: number) {
  const cx = w * 0.5
  const left = cx - w * 0.18
  const right = cx + w * 0.18
  const neckL = cx - w * 0.055
  const neckR = cx + w * 0.055
  const neckTop = h * 0.46
  const shoulder = h * 0.56
  const bottom = h * 0.84
  ctx.moveTo(neckL, neckTop)
  ctx.lineTo(neckL, shoulder)
  ctx.quadraticCurveTo(left, shoulder + 4, left, shoulder + 18)
  ctx.lineTo(left, bottom - 16)
  ctx.quadraticCurveTo(cx, bottom + 10, right, bottom - 16)
  ctx.lineTo(right, shoulder + 18)
  ctx.quadraticCurveTo(right, shoulder + 4, neckR, shoulder)
  ctx.lineTo(neckR, neckTop)
  ctx.closePath()
}

function flame(ctx: Ctx, x: number, y: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + 26)
  ctx.quadraticCurveTo(x - 16, y + 12, x - 3, y + 4)
  ctx.quadraticCurveTo(x - 12, y - 8, x, y - 24)
  ctx.quadraticCurveTo(x + 14, y - 6, x + 4, y + 4)
  ctx.quadraticCurveTo(x + 16, y + 14, x, y + 26)
  ctx.fillStyle = '#fdba74'
  ctx.strokeStyle = INK.amber
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x, y + 16)
  ctx.quadraticCurveTo(x - 5, y + 6, x, y - 6)
  ctx.quadraticCurveTo(x + 6, y + 6, x, y + 16)
  ctx.fillStyle = '#fef9c3'
  ctx.fill()
}

function stand(ctx: Ctx, w: number, h: number) {
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(w * 0.14, h * 0.9)
  ctx.lineTo(w * 0.58, h * 0.9)
  ctx.moveTo(w * 0.24, h * 0.9)
  ctx.lineTo(w * 0.24, h * 0.1)
  ctx.stroke()
}

function drawGlass(ctx: Ctx, w: number, h: number, params: FigureParams) {
  const kind = params.variant || 'tube'
  const color = params.liquid || '#7dd3fc'
  const level = params.level
  if (kind === 'lamp') {
    vessel(ctx, level, color, () => lampJar(ctx, w, h), h * 0.58, h * 0.82)
    const cx = w * 0.5
    ink(ctx, INK.muted)
    ctx.fillStyle = '#e2e8f0'
    ctx.beginPath()
    ctx.rect(cx - w * 0.09, h * 0.4, w * 0.18, h * 0.07)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx, h * 0.4)
    ctx.lineTo(cx, h * 0.34)
    ctx.stroke()
    flame(ctx, cx, h * 0.28)
  } else if (kind === 'funnel') {
    vessel(ctx, level, color, () => {
      const cx = w * 0.5
      ctx.moveTo(cx - w * 0.28, h * 0.14)
      ctx.lineTo(cx - w * 0.05, h * 0.46)
      ctx.lineTo(cx + w * 0.05, h * 0.46)
      ctx.lineTo(cx + w * 0.28, h * 0.14)
      ctx.closePath()
    }, h * 0.16, h * 0.44)
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.moveTo(w * 0.45, h * 0.46)
    ctx.lineTo(w * 0.45, h * 0.86)
    ctx.lineTo(w * 0.55, h * 0.86)
    ctx.lineTo(w * 0.55, h * 0.46)
    ctx.stroke()
  } else if (kind === 'basin') {
    const cx = w * 0.5
    const rx = w * 0.32
    const top = h * 0.4
    const bottom = h * 0.68
    vessel(ctx, level, color, () => {
      ctx.moveTo(cx - rx, top)
      ctx.lineTo(cx - rx, bottom)
      ctx.ellipse(cx, bottom, rx, 12, 0, Math.PI, 0, true)
      ctx.lineTo(cx + rx, top)
      ctx.ellipse(cx, top, rx, 12, 0, 0, Math.PI, true)
    }, top, bottom)
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.ellipse(cx, top, rx, 12, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (kind === 'tube-stand') {
    stand(ctx, w, h)
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.moveTo(w * 0.24, h * 0.32)
    ctx.lineTo(w * 0.46, h * 0.4)
    ctx.stroke()
    ctx.save()
    ctx.translate(w * 0.62, h * 0.5)
    ctx.rotate(-0.4)
    vessel(ctx, level, color, () => {
      ctx.moveTo(-16, -78)
      ctx.lineTo(-16, 36)
      ctx.arc(0, 36, 16, Math.PI, 0, true)
      ctx.lineTo(16, -78)
      ctx.closePath()
    }, -70, 52)
    ctx.restore()
  } else if (kind === 'flask') {
    vessel(ctx, level, color, () => flaskPath(ctx, w, h), h * 0.28, h * 0.9)
  } else if (kind === 'beaker') {
    vessel(ctx, level, color, () => {
      ctx.moveTo(w * 0.28, h * 0.16)
      ctx.lineTo(w * 0.32, h * 0.82)
      ctx.quadraticCurveTo(w * 0.5, h * 0.9, w * 0.68, h * 0.82)
      ctx.lineTo(w * 0.72, h * 0.28)
      ctx.lineTo(w * 0.84, h * 0.18)
      ctx.lineTo(w * 0.72, h * 0.16)
      ctx.closePath()
    }, h * 0.2, h * 0.84)
  } else if (kind === 'tube') {
    vessel(ctx, level, color, () => {
      const left = w * 0.38
      const right = w * 0.62
      const r = (right - left) / 2
      ctx.moveTo(left, h * 0.1)
      ctx.lineTo(left, h * 0.72)
      ctx.arc((left + right) / 2, h * 0.72, r, Math.PI, 0, true)
      ctx.lineTo(right, h * 0.1)
      ctx.closePath()
    }, h * 0.12, h * 0.84)
  } else if (kind === 'erlenmeyer') {
    vessel(ctx, level, color, () => {
      ctx.moveTo(w * 0.42, h * 0.1)
      ctx.lineTo(w * 0.42, h * 0.28)
      ctx.lineTo(w * 0.22, h * 0.78)
      ctx.quadraticCurveTo(w * 0.5, h * 0.9, w * 0.78, h * 0.78)
      ctx.lineTo(w * 0.58, h * 0.28)
      ctx.lineTo(w * 0.58, h * 0.1)
      ctx.closePath()
    }, h * 0.3, h * 0.82)
  } else if (kind === 'cylinder') {
    vessel(ctx, level, color, () => {
      ctx.moveTo(w * 0.36, h * 0.08)
      ctx.lineTo(w * 0.36, h * 0.82)
      ctx.quadraticCurveTo(w * 0.5, h * 0.9, w * 0.64, h * 0.82)
      ctx.lineTo(w * 0.64, h * 0.08)
      ctx.closePath()
    }, h * 0.1, h * 0.84)
    ctx.save()
    ctx.strokeStyle = '#64748b'
    ctx.lineWidth = 1
    for (let i = 1; i <= 5; i += 1) {
      const y = h * (0.2 + i * 0.1)
      ctx.beginPath()
      ctx.moveTo(w * 0.36, y)
      ctx.lineTo(w * 0.46, y)
      ctx.stroke()
    }
    ctx.restore()
  } else if (kind === 'burette') {
    stand(ctx, w, h)
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.moveTo(w * 0.24, h * 0.24)
    ctx.lineTo(w * 0.44, h * 0.24)
    ctx.stroke()
    vessel(ctx, level, color, () => {
      ctx.rect(w * 0.48, h * 0.08, w * 0.09, h * 0.6)
    }, h * 0.1, h * 0.66)
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.arc(w * 0.565, h * 0.7, 6, 0, Math.PI * 2)
    ctx.moveTo(w * 0.525, h * 0.68)
    ctx.lineTo(w * 0.525, h * 0.78)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(w * 0.46, h * 0.8)
    ctx.lineTo(w * 0.46, h * 0.84)
    ctx.lineTo(w * 0.34, h * 0.96)
    ctx.quadraticCurveTo(w * 0.5, h * 1.02, w * 0.66, h * 0.96)
    ctx.lineTo(w * 0.54, h * 0.84)
    ctx.lineTo(w * 0.54, h * 0.8)
    ctx.stroke()
  } else if (kind === 'pipette') {
    vessel(ctx, level, color, () => {
      ctx.moveTo(w * 0.46, h * 0.08)
      ctx.lineTo(w * 0.46, h * 0.32)
      ctx.bezierCurveTo(w * 0.2, h * 0.4, w * 0.2, h * 0.62, w * 0.46, h * 0.68)
      ctx.lineTo(w * 0.46, h * 0.9)
      ctx.lineTo(w * 0.54, h * 0.9)
      ctx.lineTo(w * 0.54, h * 0.68)
      ctx.bezierCurveTo(w * 0.8, h * 0.62, w * 0.8, h * 0.4, w * 0.54, h * 0.32)
      ctx.lineTo(w * 0.54, h * 0.08)
      ctx.closePath()
    }, h * 0.2, h * 0.88)
  } else {
    ink(ctx, INK.sky)
    ctx.strokeRect(w * 0.3, h * 0.2, w * 0.4, h * 0.55)
    ctx.strokeRect(w * 0.38, h * 0.2, w * 0.24, h * 0.55)
    ink(ctx, INK.blue)
    arrow(ctx, w * 0.16, h * 0.64, w * 0.3, h * 0.64)
    textAt(ctx, 'vào', w * 0.14, h * 0.74, 11, INK.blue)
    ink(ctx, INK.green)
    arrow(ctx, w * 0.7, h * 0.32, w * 0.86, h * 0.32)
    textAt(ctx, 'ra', w * 0.88, h * 0.22, 11, INK.green)
  }
  if (params.label.trim()) textAt(ctx, params.label.trim(), w / 2, h * 0.95, 14)
}

function drawScheme(ctx: Ctx, w: number, h: number, kind: string) {
  if (kind === 'ph') {
    const bands = ['#dc2626', '#f97316', '#facc15', '#4ade80', '#38bdf8', '#1d4ed8', '#6d28d9']
    const x = 28
    const width = (w - 56) / bands.length
    bands.forEach((fill, index) => {
      ctx.fillStyle = fill
      ctx.fillRect(x + index * width, h * 0.38, width, 28)
    })
    textAt(ctx, '0', x, h * 0.38 + 46, 12, INK.red)
    textAt(ctx, '7', w / 2, h * 0.38 + 46, 12, INK.green)
    textAt(ctx, '14', w - 28, h * 0.38 + 46, 12, INK.violet)
    textAt(ctx, 'axit', x + 30, h * 0.28, 12, INK.red)
    textAt(ctx, 'trung tính', w / 2, h * 0.28, 12, INK.green)
    textAt(ctx, 'bazơ', w - 50, h * 0.28, 12, INK.violet)
    return
  }
  if (kind === 'activity') {
    const metals = ['K', 'Na', 'Ca', 'Mg', 'Al', 'Zn', 'Fe', 'H', 'Cu', 'Ag']
    metals.forEach((metal, index) => {
      const color = metal === 'H' ? INK.amber : index < 7 ? INK.blue : INK.muted
      textAt(ctx, metal, 70, 22 + index * 18, 14, color)
    })
    textAt(ctx, 'dễ nhường e⁻', 200, 22, 12, INK.blue)
    textAt(ctx, 'khó nhường e⁻', 200, 22 + 9 * 18, 12, INK.muted)
    return
  }
  const yR = h - 72
  const yP = h - 36
  axes(ctx, 40, h - 28, w - 16, 18, '', 'E')
  ink(ctx, INK.blue)
  plotLine(ctx, [[52, yR], [96, yR]])
  ink(ctx, INK.red)
  plotLine(ctx, [[96, yR], [132, h - 158], [176, yP]])
  ink(ctx, INK.green)
  plotLine(ctx, [[176, yP], [250, yP]])
  textAt(ctx, 'Eₐ', 132, h - 168, 13, INK.red)
  ink(ctx, INK.violet)
  ctx.save()
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(78, yR)
  ctx.lineTo(78, yP)
  ctx.stroke()
  ctx.restore()
  textAt(ctx, 'ΔH', 96, (yR + yP) / 2, 12, INK.violet)
  textAt(ctx, 'toả nhiệt', w * 0.72, yP + 16, 12, INK.green)
  textAt(ctx, 'chất phản ứng', 86, yR - 12, 11, INK.blue)
  textAt(ctx, 'sản phẩm', 214, yP - 14, 11, INK.green)
}

function drawAtom(ctx: Ctx, w: number, h: number, kind: string) {
  if (kind === 'covalent') {
    atomDot(ctx, w * 0.32, h * 0.5, 'H')
    atomDot(ctx, w * 0.68, h * 0.5, 'H')
    ink(ctx, INK.green)
    ctx.beginPath()
    ctx.arc(w * 0.44, h * 0.5, 2.2, 0, Math.PI * 2)
    ctx.arc(w * 0.56, h * 0.5, 2.2, 0, Math.PI * 2)
    ctx.fill()
    textAt(ctx, 'cặp e⁻ chung', w * 0.5, h * 0.7, 12, INK.green)
    return
  }
  if (kind === 'ionic') {
    textAt(ctx, 'Na', w * 0.28, h * 0.45, 18, INK.blue)
    textAt(ctx, 'Cl', w * 0.72, h * 0.45, 18, INK.green)
    ink(ctx, INK.amber)
    arrow(ctx, w * 0.38, h * 0.45, w * 0.58, h * 0.45)
    textAt(ctx, 'e⁻', w * 0.48, h * 0.34, 12, INK.amber)
    textAt(ctx, 'Na⁺', w * 0.28, h * 0.68, 14, INK.blue)
    textAt(ctx, 'Cl⁻', w * 0.72, h * 0.68, 14, INK.green)
    return
  }
  const cx = w / 2
  const cy = h * 0.55
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.arc(cx, cy, 18, 0, Math.PI * 2)
  ctx.fillStyle = '#fef3c7'
  ctx.fill()
  ctx.stroke()
  textAt(ctx, 'C', cx, cy, 14, INK.amber)
  ink(ctx, INK.muted)
  for (const r of [42, 74]) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ink(ctx, INK.blue)
  const electrons: Array<[number, number]> = [[42, 0.4], [42, 3.5], [74, 0.3], [74, 1.8], [74, 3.4], [74, 5]]
  for (const [r, a] of electrons) {
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3.2, 0, Math.PI * 2)
    ctx.fill()
  }
  textAt(ctx, '2', cx + 42, cy + 16, 11, INK.sky)
  textAt(ctx, '4', cx + 58, cy + 62, 11, INK.blue)
}

type PeriodicCell = { z: number; s: string; k: string }

const PERIODIC_FILL: Record<string, string> = {
  alkali: '#fecaca',
  earth: '#fed7aa',
  transition: '#fbcfe8',
  post: '#fde68a',
  metalloid: '#d9f99d',
  nonmetal: '#bbf7d0',
  halogen: '#fef08a',
  noble: '#bae6fd',
  lanthanide: '#e9d5ff',
  actinide: '#fecdd3',
}

function periodicEl(z: number, s: string, k: string): PeriodicCell {
  return { z, s, k }
}

/** Tên tiếng Việt và nguyên tử khối. Nguyên tố phóng xạ ghi số khối trong ngoặc. */
const PERIODIC_FACT: Record<number, [string, string]> = {
  1: ['Hydro', '1,008'], 2: ['Heli', '4,003'], 3: ['Liti', '6,94'], 4: ['Beri', '9,012'], 5: ['Bo', '10,81'],
  6: ['Cacbon', '12,01'], 7: ['Nitơ', '14,01'], 8: ['Oxi', '16,00'], 9: ['Flo', '19,00'], 10: ['Neon', '20,18'],
  11: ['Natri', '22,99'], 12: ['Magie', '24,31'], 13: ['Nhôm', '26,98'], 14: ['Silic', '28,09'], 15: ['Photpho', '30,97'],
  16: ['Lưu huỳnh', '32,06'], 17: ['Clo', '35,45'], 18: ['Agon', '39,95'], 19: ['Kali', '39,10'], 20: ['Canxi', '40,08'],
  21: ['Scandi', '44,96'], 22: ['Titan', '47,87'], 23: ['Vanadi', '50,94'], 24: ['Crom', '52,00'], 25: ['Mangan', '54,94'],
  26: ['Sắt', '55,85'], 27: ['Coban', '58,93'], 28: ['Niken', '58,69'], 29: ['Đồng', '63,55'], 30: ['Kẽm', '65,38'],
  31: ['Gali', '69,72'], 32: ['Gecmani', '72,63'], 33: ['Asen', '74,92'], 34: ['Selen', '78,97'], 35: ['Brom', '79,90'],
  36: ['Kripton', '83,80'], 37: ['Rubiđi', '85,47'], 38: ['Stronti', '87,62'], 39: ['Ytri', '88,91'], 40: ['Zirconi', '91,22'],
  41: ['Niobi', '92,91'], 42: ['Molypden', '95,95'], 43: ['Tecneti', '(98)'], 44: ['Ruteni', '101,1'], 45: ['Rodi', '102,9'],
  46: ['Paladi', '106,4'], 47: ['Bạc', '107,9'], 48: ['Cadimi', '112,4'], 49: ['Inđi', '114,8'], 50: ['Thiếc', '118,7'],
  51: ['Antimon', '121,8'], 52: ['Telu', '127,6'], 53: ['Iot', '126,9'], 54: ['Xenon', '131,3'], 55: ['Xesi', '132,9'],
  56: ['Bari', '137,3'], 57: ['Lantan', '138,9'], 58: ['Xeri', '140,1'], 59: ['Prazeođim', '140,9'], 60: ['Neodim', '144,2'],
  61: ['Prometi', '(145)'], 62: ['Samari', '150,4'], 63: ['Europi', '152,0'], 64: ['Gadolini', '157,3'], 65: ['Tecbi', '158,9'],
  66: ['Dysprosi', '162,5'], 67: ['Honmi', '164,9'], 68: ['Erbi', '167,3'], 69: ['Tuli', '168,9'], 70: ['Ytecbi', '173,0'],
  71: ['Luteti', '175,0'], 72: ['Hafni', '178,5'], 73: ['Tantan', '180,9'], 74: ['Vonfram', '183,8'], 75: ['Reni', '186,2'],
  76: ['Osmi', '190,2'], 77: ['Iridi', '192,2'], 78: ['Platin', '195,1'], 79: ['Vàng', '197,0'], 80: ['Thủy ngân', '200,6'],
  81: ['Tali', '204,4'], 82: ['Chì', '207,2'], 83: ['Bitmut', '209,0'], 84: ['Poloni', '(209)'], 85: ['Astatin', '(210)'],
  86: ['Radon', '(222)'], 87: ['Franxi', '(223)'], 88: ['Radi', '(226)'], 89: ['Actini', '(227)'], 90: ['Thori', '232,0'],
  91: ['Protactini', '231,0'], 92: ['Urani', '238,0'], 93: ['Neptuni', '(237)'], 94: ['Plutoni', '(244)'], 95: ['Americi', '(243)'],
  96: ['Curi', '(247)'], 97: ['Berkeli', '(247)'], 98: ['Californi', '(251)'], 99: ['Einsteini', '(252)'], 100: ['Fecmi', '(257)'],
  101: ['Mendelevi', '(258)'], 102: ['Nobeli', '(259)'], 103: ['Lorenxi', '(266)'], 104: ['Rutherfordi', '(267)'], 105: ['Dubni', '(268)'],
  106: ['Seaboogi', '(269)'], 107: ['Bohri', '(270)'], 108: ['Hassi', '(270)'], 109: ['Meitneri', '(278)'], 110: ['Darmstadti', '(281)'],
  111: ['Roentgeni', '(282)'], 112: ['Copernici', '(285)'], 113: ['Nihoni', '(286)'], 114: ['Flerovi', '(289)'], 115: ['Moscovi', '(290)'],
  116: ['Livermori', '(293)'], 117: ['Tennessin', '(294)'], 118: ['Oganesson', '(294)'],
}

function drawPeriodic(ctx: Ctx, w: number, h: number, highlight: string) {
  const alkali = 'alkali'
  const earth = 'earth'
  const transition = 'transition'
  const post = 'post'
  const metalloid = 'metalloid'
  const nonmetal = 'nonmetal'
  const halogen = 'halogen'
  const noble = 'noble'
  const lanthanide = 'lanthanide'
  const actinide = 'actinide'
  const line = (): Array<PeriodicCell | null> => Array.from({ length: 18 }, () => null)
  const main = [line(), line(), line(), line(), line(), line(), line()]
  const put = (period: number, col: number, cell: PeriodicCell) => {
    main[period - 1][col] = cell
  }
  const series = (period: number, col: number, items: Array<[number, string, string]>) => {
    items.forEach((item, index) => put(period, col + index, periodicEl(item[0], item[1], item[2])))
  }
  put(1, 0, periodicEl(1, 'H', nonmetal))
  put(1, 17, periodicEl(2, 'He', noble))
  series(2, 0, [[3, 'Li', alkali], [4, 'Be', earth]])
  series(2, 12, [[5, 'B', metalloid], [6, 'C', nonmetal], [7, 'N', nonmetal], [8, 'O', nonmetal], [9, 'F', halogen], [10, 'Ne', noble]])
  series(3, 0, [[11, 'Na', alkali], [12, 'Mg', earth]])
  series(3, 12, [[13, 'Al', post], [14, 'Si', metalloid], [15, 'P', nonmetal], [16, 'S', nonmetal], [17, 'Cl', halogen], [18, 'Ar', noble]])
  series(4, 0, [[19, 'K', alkali], [20, 'Ca', earth], [21, 'Sc', transition], [22, 'Ti', transition], [23, 'V', transition], [24, 'Cr', transition], [25, 'Mn', transition], [26, 'Fe', transition], [27, 'Co', transition], [28, 'Ni', transition], [29, 'Cu', transition], [30, 'Zn', transition], [31, 'Ga', post], [32, 'Ge', metalloid], [33, 'As', metalloid], [34, 'Se', nonmetal], [35, 'Br', halogen], [36, 'Kr', noble]])
  series(5, 0, [[37, 'Rb', alkali], [38, 'Sr', earth], [39, 'Y', transition], [40, 'Zr', transition], [41, 'Nb', transition], [42, 'Mo', transition], [43, 'Tc', transition], [44, 'Ru', transition], [45, 'Rh', transition], [46, 'Pd', transition], [47, 'Ag', transition], [48, 'Cd', transition], [49, 'In', post], [50, 'Sn', post], [51, 'Sb', metalloid], [52, 'Te', metalloid], [53, 'I', halogen], [54, 'Xe', noble]])
  series(6, 0, [[55, 'Cs', alkali], [56, 'Ba', earth]])
  put(6, 2, periodicEl(0, '*', lanthanide))
  series(6, 3, [[72, 'Hf', transition], [73, 'Ta', transition], [74, 'W', transition], [75, 'Re', transition], [76, 'Os', transition], [77, 'Ir', transition], [78, 'Pt', transition], [79, 'Au', transition], [80, 'Hg', transition], [81, 'Tl', post], [82, 'Pb', post], [83, 'Bi', post], [84, 'Po', metalloid], [85, 'At', halogen], [86, 'Rn', noble]])
  series(7, 0, [[87, 'Fr', alkali], [88, 'Ra', earth]])
  put(7, 2, periodicEl(0, '**', actinide))
  series(7, 3, [[104, 'Rf', transition], [105, 'Db', transition], [106, 'Sg', transition], [107, 'Bh', transition], [108, 'Hs', transition], [109, 'Mt', transition], [110, 'Ds', transition], [111, 'Rg', transition], [112, 'Cn', transition], [113, 'Nh', post], [114, 'Fl', post], [115, 'Mc', post], [116, 'Lv', post], [117, 'Ts', halogen], [118, 'Og', noble]])
  const fBlock = (symbols: string[], z0: number, kind: string) => symbols.map((s, index) => periodicEl(z0 + index, s, kind))
  const lanthanides = fBlock(['La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu'], 57, lanthanide)
  const actinides = fBlock(['Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr'], 89, actinide)
  const left = 18
  const top = 16
  const foot = 14
  const gap = 8
  const cw = (w - left - 4) / 18
  const ch = (h - top - foot - gap) / 9
  const mark = highlight.trim().toLowerCase()
  const paint = (cell: PeriodicCell, x: number, y: number) => {
    ctx.fillStyle = PERIODIC_FILL[cell.k] || '#e2e8f0'
    ctx.fillRect(x + 0.5, y + 0.5, Math.max(1, cw - 2), Math.max(1, ch - 2))
    const marked = cell.z > 0 && (cell.s.toLowerCase() === mark || String(cell.z) === highlight.trim())
    ctx.strokeStyle = marked ? '#0f172a' : '#64748b'
    ctx.lineWidth = marked ? 1.8 : 0.8
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, cw - 2), Math.max(1, ch - 2))
    const fact = cell.z > 0 ? PERIODIC_FACT[cell.z] : undefined
    const symbolSize = Math.max(8, Math.min(16, ch * 0.28))
    if (ch >= 28 && cell.z > 0 && fact) {
      const small = Math.max(7, Math.min(10, ch * 0.16))
      ctx.save()
      ctx.fillStyle = '#64748b'
      ctx.font = `${small}px ui-sans-serif, system-ui, sans-serif`
      ctx.textBaseline = 'top'
      ctx.textAlign = 'left'
      ctx.fillText(String(cell.z), x + 2, y + 1)
      ctx.textAlign = 'right'
      ctx.fillText(fact[1], x + cw - 3, y + 1)
      ctx.restore()
      textAt(ctx, cell.s, x + cw / 2, y + ch * 0.48, symbolSize, '#0f172a')
      const nameSize = fact[0].length > 10 ? 7 : fact[0].length > 8 ? 8 : Math.max(8, Math.min(11, ch * 0.16))
      textAt(ctx, fact[0], x + cw / 2, y + ch * 0.78, nameSize, '#334155')
    } else if (ch >= 18 && cell.z > 0) {
      ctx.save()
      ctx.fillStyle = '#64748b'
      ctx.font = `${Math.max(7, Math.min(9, ch * 0.22))}px ui-sans-serif, system-ui, sans-serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(String(cell.z), x + 2, y + 1)
      ctx.restore()
      textAt(ctx, cell.s, x + cw / 2, y + ch * 0.62, symbolSize, '#0f172a')
    } else {
      textAt(ctx, cell.s, x + cw / 2, y + ch / 2, symbolSize, '#0f172a')
    }
  }
  for (let col = 0; col < 18; col += 1) textAt(ctx, String(col + 1), left + col * cw + cw / 2, 8, 9, INK.muted)
  main.forEach((row, period) => {
    const y = top + period * ch
    textAt(ctx, String(period + 1), 8, y + ch / 2, 9, INK.muted)
    row.forEach((cell, col) => {
      if (cell) paint(cell, left + col * cw, y)
    })
  })
  const fY = top + 7 * ch + gap
  textAt(ctx, '*', 8, fY + ch / 2, 9, INK.violet)
  textAt(ctx, '**', 8, fY + ch + ch / 2, 8, INK.red)
  lanthanides.forEach((cell, index) => paint(cell, left + (2 + index) * cw, fY))
  actinides.forEach((cell, index) => paint(cell, left + (2 + index) * cw, fY + ch))
  textAt(ctx, 'mỗi ô: số hiệu · nguyên tử khối · kí hiệu · tên    * họ lantan  ** họ actini', w / 2, h - 7, 10, INK.muted)
}

function electroButton(w: number, h: number) {
  return { x: w * 0.72, y: h * 0.24 }
}

export function setWaveSources(params: FigureParams, both: boolean): FigureParams {
  const tune = baseTune(params, 2, [0.2, 1])
  tune[1] = both ? 1 : 0
  return withTune(params, tune)
}

export function toggleChemSwitch(params: FigureParams): FigureParams {
  const on = tuneAt(params.tune, 0, 1) >= 0.5
  return { ...params, tune: [on ? 0 : 1] }
}

function drawChemExperiment(ctx: Ctx, w: number, h: number, kind: string, tune?: number[], time = 0) {
  if (kind === 'collect') {
    const basinTop = h * 0.58
    const basinLeft = w * 0.4
    const basinRight = w * 0.94
    ctx.fillStyle = '#e0f2fe'
    ctx.strokeStyle = INK.sky
    ctx.beginPath()
    ctx.rect(basinLeft, basinTop, basinRight - basinLeft, h * 0.3)
    ctx.fill()
    ctx.stroke()
    const tubeLeft = w * 0.58
    const tubeRight = w * 0.74
    const tubeTop = h * 0.16
    const tubeMouth = basinTop + h * 0.16
    const open = tuneAt(tune, 0, 1) >= 0.5
    const gas = open ? 0.15 + 0.7 * wrap01(time * 0.12) : 0
    const waterLine = tubeTop + 16 + gas * (tubeMouth - tubeTop - 22)
    ctx.save()
    ctx.beginPath()
    ctx.rect(tubeLeft, tubeTop, tubeRight - tubeLeft, tubeMouth - tubeTop)
    ctx.clip()
    ctx.fillStyle = '#bae6fd'
    ctx.fillRect(tubeLeft, waterLine, tubeRight - tubeLeft, tubeMouth - waterLine + 2)
    ctx.restore()
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.moveTo(tubeLeft, tubeMouth)
    ctx.lineTo(tubeLeft, tubeTop + 10)
    ctx.quadraticCurveTo((tubeLeft + tubeRight) / 2, tubeTop - 8, tubeRight, tubeTop + 10)
    ctx.lineTo(tubeRight, tubeMouth)
    ctx.stroke()
    if (gas > 0.04) textAt(ctx, 'H₂', (tubeLeft + tubeRight) / 2, (tubeTop + waterLine) / 2, 12, INK.green)
    textAt(ctx, 'nước', tubeRight + 8, (waterLine + tubeMouth) / 2, 11, INK.sky)
    const flaskL = w * 0.08
    const flaskR = w * 0.26
    const flaskTop = h * 0.3
    const flaskBot = h * 0.72
    ctx.strokeStyle = INK.sky
    ctx.strokeRect(flaskL, flaskTop, flaskR - flaskL, flaskBot - flaskTop)
    ctx.fillStyle = '#bae6fd'
    ctx.fillRect(flaskL + 1, flaskTop + (flaskBot - flaskTop) * 0.45, flaskR - flaskL - 2, (flaskBot - flaskTop) * 0.55 - 1)
    textAt(ctx, 'Zn + HCl', (flaskL + flaskR) / 2, flaskTop - 12, 11, INK.amber)
    const neck = (flaskL + flaskR) / 2
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.moveTo(neck, flaskTop)
    ctx.lineTo(neck, flaskTop - 14)
    ctx.lineTo(w * 0.36, flaskTop - 14)
    ctx.quadraticCurveTo(w * 0.48, flaskTop + 8, (tubeLeft + tubeRight) / 2, tubeMouth - 4)
    ctx.stroke()
    textAt(ctx, 'nước chậu', basinRight - 36, basinTop + 16, 11, INK.sky)
    knob(ctx, (flaskL + flaskR) / 2, flaskTop + (flaskBot - flaskTop) * 0.55)
    textAt(ctx, open ? 'Zn + 2HCl → ZnCl₂ + H₂' : 'chưa mở, ống đầy nước', w * 0.34, h - 12, 11, open ? INK.blue : INK.muted)
    textAt(ctx, open ? 'H₂ nhẹ, dâng lên, đẩy nước xuống' : '', w * 0.72, h - 12, 11, INK.green)
    if (open) {
      const rise = wrap01(time * 0.35)
      ink(ctx, INK.green)
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath()
        ctx.arc((tubeLeft + tubeRight) / 2, tubeMouth - 8 - wrap01(rise + i / 3) * (tubeMouth - waterLine - 10), 2.6, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    return
  }
  if (kind === 'heat') {
    stand(ctx, w, h)
    const frac = clampNum(tuneAt(tune, 0, 0.42), 0.18, 0.72)
    const hot = Math.abs(frac - 0.42) < 0.08
    flame(ctx, frac * w, h * 0.62)
    knob(ctx, frac * w, h * 0.62)
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.moveTo(w * 0.34, h * 0.34)
    ctx.lineTo(w * 0.7, h * 0.5)
    ctx.lineTo(w * 0.7, h * 0.58)
    ctx.lineTo(w * 0.34, h * 0.42)
    ctx.closePath()
    ctx.stroke()
    ctx.fillStyle = '#fed7aa'
    ctx.fillRect(w * 0.36, h * 0.4, 16, 10)
    textAt(ctx, 'CaCO₃', w * 0.28, h * 0.3, 12, INK.amber)
    ink(ctx, INK.muted)
    ctx.beginPath()
    ctx.moveTo(w * 0.7, h * 0.52)
    ctx.lineTo(w * 0.78, h * 0.52)
    ctx.lineTo(w * 0.78, h * 0.7)
    ctx.stroke()
    ctx.strokeStyle = INK.sky
    ctx.strokeRect(w * 0.7, h * 0.68, w * 0.18, h * 0.16)
    ctx.fillStyle = hot ? '#e7e5e4' : '#e0f2fe'
    ctx.fillRect(w * 0.7, h * 0.76, w * 0.18, h * 0.08)
    textAt(ctx, hot ? 'vôi trong vẩn đục' : 'nước vôi trong', w * 0.79, h * 0.66, 10, hot ? INK.muted : INK.sky)
    textAt(ctx, hot ? 'CaCO₃ → CaO + CO₂' : 'đưa đèn vào dưới bột', w * 0.36, h - 12, 11, hot ? INK.amber : INK.muted)
    textAt(ctx, 'đèn cồn', frac * w, h * 0.9, 12, INK.amber)
    if (hot) {
      const rise = wrap01(time * 0.4)
      ink(ctx, INK.green)
      ctx.beginPath()
      ctx.arc(w * 0.7, h * 0.4 - rise * 18, 3, 0, Math.PI * 2)
      ctx.stroke()
    }
    return
  }
  const on = tuneAt(tune, 0, 1) >= 0.5
  const cell = { x: 52, y: h * 0.24 }
  const button = electroButton(w, h)
  const vatLeft = w * 0.24
  const vatRight = w * 0.66
  const vatTop = h * 0.42
  const vatBottom = h * 0.82
  const cathode = vatLeft + 36
  const anode = vatRight - 36
  const negX = cell.x - 14
  const posX = cell.x - 4
  const lowY = (cell.y + vatTop) / 2
  const highY = cell.y - 22
  const returnX = button.x + 28
  ink(ctx, INK.text)
  ctx.beginPath()
  ctx.moveTo(negX, cell.y - 9)
  ctx.lineTo(negX, cell.y + 9)
  ctx.moveTo(posX, cell.y - 15)
  ctx.lineTo(posX, cell.y + 15)
  ctx.stroke()
  textAt(ctx, 'nguồn', cell.x - 8, cell.y - 26, 11, INK.muted)
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(negX, cell.y)
  ctx.lineTo(negX, lowY)
  ctx.lineTo(cathode, lowY)
  ctx.lineTo(cathode, vatTop - 6)
  ctx.stroke()
  ink(ctx, INK.red)
  ctx.beginPath()
  ctx.moveTo(posX, cell.y)
  ctx.lineTo(posX, highY)
  ctx.lineTo(button.x - 16, highY)
  ctx.lineTo(button.x - 16, button.y)
  ctx.moveTo(button.x + 16, button.y)
  ctx.lineTo(returnX, button.y)
  ctx.lineTo(returnX, lowY)
  ctx.lineTo(anode, lowY)
  ctx.lineTo(anode, vatTop - 6)
  ctx.stroke()
  ink(ctx, on ? INK.green : INK.amber)
  ctx.beginPath()
  ctx.moveTo(button.x - 16, button.y)
  ctx.lineTo(button.x - 7, button.y)
  ctx.moveTo(button.x + 7, button.y)
  ctx.lineTo(button.x + 16, button.y)
  ctx.moveTo(button.x - 7, button.y - 6)
  ctx.lineTo(button.x - 7, button.y + 6)
  ctx.moveTo(button.x + 7, button.y - 6)
  ctx.lineTo(button.x + 7, button.y + 6)
  if (on) {
    ctx.moveTo(button.x - 7, button.y)
    ctx.lineTo(button.x + 7, button.y)
  }
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(button.x, on ? button.y - 12 : button.y - 18, 8, 0, Math.PI * 2)
  ctx.fillStyle = on ? '#dcfce7' : '#fff7ed'
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(button.x, on ? button.y - 4 : button.y - 10)
  ctx.lineTo(button.x, button.y - 6)
  ctx.stroke()
  textAt(ctx, on ? 'nhả' : 'nhấn', button.x, button.y - 34, 11, on ? INK.green : INK.amber)
  ctx.fillStyle = '#e0f2fe'
  ctx.strokeStyle = INK.sky
  ctx.beginPath()
  ctx.rect(vatLeft, vatTop, vatRight - vatLeft, vatBottom - vatTop)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#334155'
  ctx.fillRect(cathode - 3, vatTop - 8, 6, vatBottom - vatTop - 8)
  ctx.fillRect(anode - 3, vatTop - 8, 6, vatBottom - vatTop - 8)
  textAt(ctx, 'catot −', cathode, vatTop - 18, 11, INK.blue)
  textAt(ctx, 'anot +', anode, vatTop - 18, 11, INK.red)
  textAt(ctx, 'H₂', cathode, vatTop + 16, 13, INK.blue)
  textAt(ctx, 'O₂', anode, vatTop + 16, 13, INK.red)
  if (on) {
    textAt(ctx, '2V', cathode - 22, vatTop + 32, 11, INK.blue)
    textAt(ctx, '1V', anode + 22, vatTop + 32, 11, INK.red)
    const rise = wrap01(time * 0.45)
    ink(ctx, INK.sky)
    for (const [x, n] of [[cathode, 4], [anode, 2]] as Array<[number, number]>) {
      for (let i = 0; i < n; i += 1) {
        const bubble = wrap01(rise + i / n)
        ctx.beginPath()
        ctx.arc(x + (i - (n - 1) / 2) * 7, vatBottom - 16 - bubble * (vatBottom - vatTop - 36), 3, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    const flow = wrap01(time * 0.55)
    const midY = (vatTop + vatBottom) / 2
    ink(ctx, INK.amber)
    ctx.beginPath()
    ctx.moveTo(anode - 16, midY)
    ctx.lineTo(cathode + 20, midY)
    ctx.moveTo(cathode + 20, midY)
    ctx.lineTo(cathode + 28, midY - 5)
    ctx.moveTo(cathode + 20, midY)
    ctx.lineTo(cathode + 28, midY + 5)
    ctx.stroke()
    const leg = [
      [posX, cell.y],
      [posX, highY],
      [button.x - 16, highY],
      [button.x - 16, button.y],
      [button.x + 16, button.y],
      [returnX, button.y],
      [returnX, lowY],
      [anode, lowY],
      [anode, midY],
      [cathode, midY],
      [cathode, lowY],
      [negX, lowY],
      [negX, cell.y],
    ] as Array<[number, number]>
    let span = 0
    for (let i = 1; i < leg.length; i += 1) span += Math.hypot(leg[i][0] - leg[i - 1][0], leg[i][1] - leg[i - 1][1])
    ink(ctx, INK.amber)
    for (let i = 0; i < 3; i += 1) {
      let remain = wrap01(flow + i / 3) * span
      let x = leg[0][0]
      let y = leg[0][1]
      for (let k = 1; k < leg.length; k += 1) {
        const step = Math.hypot(leg[k][0] - leg[k - 1][0], leg[k][1] - leg[k - 1][1])
        if (remain <= step || k === leg.length - 1) {
          const t = step === 0 ? 0 : Math.min(1, remain / step)
          x = leg[k - 1][0] + (leg[k][0] - leg[k - 1][0]) * t
          y = leg[k - 1][1] + (leg[k][1] - leg[k - 1][1]) * t
          break
        }
        remain -= step
      }
      ctx.beginPath()
      ctx.arc(x, y, 2.2, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  textAt(ctx, 'H₂SO₄ loãng', (vatLeft + vatRight) / 2, vatBottom - 32, 11, INK.amber)
  textAt(ctx, 'nước', (vatLeft + vatRight) / 2, vatBottom - 14, 12, INK.sky)
  textAt(ctx, 'H₂SO₄ loãng', w * 0.84, h * 0.5, 12, INK.amber)
  textAt(ctx, 'chỉ dẫn điện', w * 0.84, h * 0.58, 11, INK.muted)
  textAt(ctx, 'không bị điện phân', w * 0.84, h * 0.66, 11, INK.muted)
  textAt(ctx, on ? 'catot 2H⁺+2e→H₂' : 'mạch hở, không có khí', w * 0.3, h - 12, 11, on ? INK.blue : INK.muted)
  textAt(ctx, on ? 'anot 2H₂O→O₂+4H⁺+4e' : '', w * 0.72, h - 12, 11, INK.red)
}

function drawTitration(ctx: Ctx, w: number, h: number, params: FigureParams, time = 0) {
  const open = titrationOpen(params.tune)
  const poured = titrationPoured(params.tune, time)
  const mix = titrationMix(poured)
  const flaskShade = phenolphthaleinColor(mix.acidLeft, mix.excess)
  const paperShade = litmusColor(mix.acidLeft, mix.excess)
  const cock = titrationCock(w, h)
  const tubeW = Math.max(16, Math.min(22, w * 0.08))
  const tubeTop = 24
  const tubeBot = cock.y - 12
  const left = cock.x - tubeW / 2
  const bulbR = Math.min(w * 0.2, h * 0.17)
  const bulbY = h * 0.7
  ink(ctx, INK.sky)
  ctx.strokeRect(left, tubeTop, tubeW, tubeBot - tubeTop)
  const column = Math.max(0, tubeBot - tubeTop - 6) * (mix.baseLeft / TITRATION_BASE)
  ctx.fillStyle = '#e0f2fe'
  ctx.fillRect(left + 2, tubeBot - column, tubeW - 4, column)
  ink(ctx, INK.amber)
  ctx.beginPath()
  const shut = open <= 0.2
  ctx.moveTo(cock.x, tubeBot)
  ctx.lineTo(cock.x, cock.y + 16)
  ctx.moveTo(shut ? cock.x - 12 : cock.x, shut ? cock.y : cock.y - 12)
  ctx.lineTo(shut ? cock.x + 12 : cock.x, shut ? cock.y : cock.y + 12)
  ctx.stroke()
  knob(ctx, cock.x, cock.y)
  if (open > 0.2) {
    const drop = wrap01(time * 1.2)
    ctx.fillStyle = '#e0f2fe'
    ctx.strokeStyle = INK.sky
    ctx.lineWidth = 1.25
    ctx.beginPath()
    ctx.arc(cock.x, cock.y + 22 + drop * h * 0.08, 2.6, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.moveTo(cock.x - 6, cock.y + 16)
  ctx.lineTo(cock.x - 6, bulbY - bulbR + 6)
  ctx.moveTo(cock.x + 6, cock.y + 16)
  ctx.lineTo(cock.x + 6, bulbY - bulbR + 6)
  ctx.stroke()
  const liquidTop = bulbY + bulbR * 0.08
  ctx.save()
  ctx.beginPath()
  ctx.arc(cock.x, bulbY, bulbR, 0, Math.PI * 2)
  ctx.clip()
  ctx.fillStyle = flaskShade
  ctx.fillRect(cock.x - bulbR - 2, liquidTop, bulbR * 2 + 4, bulbR)
  ctx.strokeStyle = '#94a3b8'
  ctx.lineWidth = 1.25
  ctx.beginPath()
  ctx.moveTo(cock.x - bulbR * 0.7, liquidTop)
  ctx.quadraticCurveTo(cock.x, liquidTop + 5, cock.x + bulbR * 0.7, liquidTop)
  ctx.stroke()
  ctx.restore()
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.arc(cock.x, bulbY, bulbR, 0, Math.PI * 2)
  ctx.stroke()
  const standX = cock.x - bulbR - 18
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(standX - 18, h * 0.9)
  ctx.lineTo(standX + 24, h * 0.9)
  ctx.moveTo(standX, h * 0.9)
  ctx.lineTo(standX, tubeTop + 10)
  ctx.lineTo(left - 2, tubeTop + 16)
  ctx.stroke()
  const labelX = w - 36
  const acidN = Math.round(mix.acidLeft)
  const baseN = Math.round(mix.baseLeft)
  const extraN = Math.round(mix.excess)
  textAt(ctx, 'buret', labelX, 36, 12, INK.sky)
  textAt(ctx, `bazơ ${baseN}`, labelX, 58, 11, INK.sky)
  ctx.save()
  ctx.fillStyle = '#fff7ed'
  ctx.strokeStyle = INK.amber
  ctx.lineWidth = 1.5
  ctx.fillRect(labelX - 18, cock.y - 10, 36, 20)
  ctx.strokeRect(labelX - 18, cock.y - 10, 36, 20)
  ctx.restore()
  textAt(ctx, shut ? 'mở' : 'đóng', labelX, cock.y, 11, INK.amber)
  textAt(ctx, 'bình', labelX, bulbY - 10, 12, INK.blue)
  textAt(ctx, extraN > 0 ? `dư ${extraN}` : acidN === 0 ? 'trung hòa' : `axit ${acidN}`, labelX, bulbY + 16, 11, INK.blue)
  textAt(ctx, mix.excess > 0.15 ? 'hồng' : 'không màu', labelX, bulbY + 40, 11, mix.excess > 0.15 ? '#be185d' : INK.muted)
  textAt(ctx, 'phenolphtalein', labelX, bulbY + 62, 10, INK.muted)
  const stage = extraN > 0 ? 'bazơ dư' : acidN === 0 ? 'trung hòa' : 'bazơ chảy vào axit'
  const note = poured < 0.3 && open <= 0.2
    ? 'khoá kín, bazơ chưa chảy'
    : open <= 0.2
      ? `dừng, ${stage}`
      : stage
  textAt(ctx, note, w * 0.48, h - 14, 11, open > 0.2 ? INK.green : INK.muted)
  const quỳWord = litmusWord(mix.acidLeft, mix.excess)
  textAt(ctx, 'quỳ', 24, h * 0.46, 11, INK.muted)
  textAt(ctx, quỳWord, 24, h * 0.8, 11, paperShade)
  ctx.save()
  ctx.fillStyle = paperShade
  ctx.strokeStyle = '#0f172a'
  ctx.lineWidth = 1.5
  ctx.fillRect(10, h * 0.5, 26, h * 0.24)
  ctx.strokeRect(10, h * 0.5, 26, h * 0.24)
  ctx.restore()
  if (params.label.trim()) textAt(ctx, params.label.trim(), w / 2, h * 0.97, 13)
}

function drawBioGraph(ctx: Ctx, w: number, h: number, logistic: boolean) {
  axes(ctx, 42, h - 36, w - 16, 20, 't', 'N')
  const pts: Array<[number, number]> = []
  for (let i = 0; i <= 30; i += 1) {
    const t = i / 30
    const y = logistic ? 130 / (1 + Math.exp(-10 * (t - 0.45))) : 8 * Math.exp(2.4 * t)
    pts.push([42 + t * (w - 70), h - 40 - Math.min(140, y)])
  }
  ink(ctx, logistic ? INK.green : INK.amber)
  plotLine(ctx, pts)
  if (logistic) {
    ink(ctx, INK.red)
    ctx.save()
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(42, h - 40 - 130)
    ctx.lineTo(w - 24, h - 40 - 130)
    ctx.stroke()
    ctx.restore()
    textAt(ctx, 'K', w - 16, h - 40 - 130, 12, INK.red)
  } else {
    textAt(ctx, 'mũ', w * 0.72, 28, 12, INK.amber)
  }
}

function drawEcology(ctx: Ctx, w: number, h: number, pyramid: boolean) {
  if (!pyramid) {
    const nodes: Array<[string, number, number, string]> = [
      ['cỏ', w * 0.5, h * 0.72, INK.green],
      ['thỏ', w * 0.28, h * 0.4, INK.amber],
      ['châu chấu', w * 0.72, h * 0.4, INK.sky],
      ['cáo', w * 0.5, h * 0.16, INK.red],
    ]
    ink(ctx, INK.muted)
    arrow(ctx, nodes[0][1], nodes[0][2] - 10, nodes[1][1], nodes[1][2] + 12)
    arrow(ctx, nodes[0][1], nodes[0][2] - 10, nodes[2][1], nodes[2][2] + 12)
    arrow(ctx, nodes[1][1], nodes[1][2] - 12, nodes[3][1] - 16, nodes[3][2] + 14)
    arrow(ctx, nodes[2][1], nodes[2][2] - 12, nodes[3][1] + 16, nodes[3][2] + 14)
    for (const [name, x, y, color] of nodes) textAt(ctx, name, x, y, 13, color)
    textAt(ctx, 'mũi tên: năng lượng', w * 0.5, h - 16, 11, INK.muted)
    return
  }
  const bands = [w * 0.72, w * 0.5, w * 0.28]
  const names = ['sinh vật sản xuất', 'sinh vật tiêu thụ bậc 1', 'sinh vật tiêu thụ bậc 2']
  const fills = ['#bbf7d0', '#fde68a', '#fecaca']
  const strokes = [INK.green, INK.amber, INK.red]
  bands.forEach((width, index) => {
    const y = h * 0.62 - index * 48
    ctx.fillStyle = fills[index]
    ctx.strokeStyle = strokes[index]
    ctx.fillRect((w - width) / 2, y, width, 40)
    ctx.strokeRect((w - width) / 2, y, width, 40)
    textAt(ctx, names[index], w / 2, y + 20, 12, strokes[index])
  })
}

function drawGenetic(ctx: Ctx, w: number, h: number, codon: boolean) {
  if (!codon) {
    const y1 = h * 0.38
    const y2 = h * 0.62
    ink(ctx, INK.sky)
    ctx.beginPath()
    for (let i = 0; i <= 40; i += 1) {
      const x = 20 + i * ((w - 40) / 40)
      const wave = Math.sin(i / 4) * 10
      if (i === 0) ctx.moveTo(x, y1 + wave)
      else ctx.lineTo(x, y1 + wave)
    }
    ctx.stroke()
    ink(ctx, INK.violet)
    ctx.beginPath()
    for (let i = 0; i <= 40; i += 1) {
      const x = 20 + i * ((w - 40) / 40)
      const wave = Math.sin(i / 4) * 10
      if (i === 0) ctx.moveTo(x, y2 - wave)
      else ctx.lineTo(x, y2 - wave)
    }
    ctx.stroke()
    const bases = ['A', 'T', 'G', 'C', 'A']
    const baseColor: Record<string, string> = { A: INK.green, T: INK.red, G: INK.amber, C: INK.blue }
    bases.forEach((base, index) => {
      const x = 50 + index * 56
      const pair = base === 'A' ? 'T' : base === 'T' ? 'A' : base === 'G' ? 'C' : 'G'
      ink(ctx, INK.muted)
      ctx.beginPath()
      ctx.moveTo(x, y1 + 8)
      ctx.lineTo(x, y2 - 8)
      ctx.stroke()
      textAt(ctx, base, x, y1 - 16, 12, baseColor[base])
      textAt(ctx, pair, x, y2 + 16, 12, baseColor[pair])
    })
    textAt(ctx, 'liên kết H', w - 58, (y1 + y2) / 2, 11, INK.muted)
    return
  }
  richLine(ctx, [
    { text: "mARN  5'  ", color: INK.muted },
    { text: 'AUG', color: INK.green },
    { text: '  ', color: INK.muted },
    { text: 'UUU', color: INK.amber },
    { text: '  ', color: INK.muted },
    { text: 'GGA', color: INK.blue },
    { text: "  3'", color: INK.muted },
  ], w / 2, h * 0.32, 15)
  textAt(ctx, 'codon', w * 0.22, h * 0.2, 11, INK.muted)
  textAt(ctx, 'tARN   UAC', w * 0.42, h * 0.55, 14, INK.green)
  textAt(ctx, 'axit amin', w * 0.62 + 35, h * 0.78, 11, INK.amber)
  ink(ctx, INK.amber)
  ctx.strokeRect(w * 0.62, h * 0.46, 70, 28)
  textAt(ctx, 'Met', w * 0.62 + 35, h * 0.46 + 14, 13, INK.amber)
}

function xShape(ctx: Ctx, x: number, y: number, s = 7, color = INK.blue) {
  ink(ctx, color)
  ctx.beginPath()
  ctx.moveTo(x - s, y - s)
  ctx.lineTo(x + s, y + s)
  ctx.moveTo(x + s, y - s)
  ctx.lineTo(x - s, y + s)
  ctx.stroke()
}

function rod(ctx: Ctx, x: number, y: number, color = INK.blue) {
  ink(ctx, color)
  ctx.beginPath()
  ctx.moveTo(x, y - 9)
  ctx.lineTo(x, y + 9)
  ctx.stroke()
}

function drawDivision(ctx: Ctx, w: number, h: number, meiosis: boolean) {
  const labels = meiosis
    ? ['Kỳ đầu I', 'Kỳ giữa I', 'Kỳ sau I', 'Kỳ cuối I']
    : ['Kỳ đầu', 'Kỳ giữa', 'Kỳ sau', 'Kỳ cuối']
  const step = (w - 48) / 4
  labels.forEach((name, index) => {
    const cx = 28 + step * index + step / 2
    const cy = h * 0.36
    ink(ctx, INK.muted)
    ctx.beginPath()
    if (index < 3) ctx.ellipse(cx, cy, 30, 38, 0, 0, Math.PI * 2)
    else {
      ctx.ellipse(cx - 16, cy, 16, 26, 0, 0, Math.PI * 2)
      ctx.ellipse(cx + 16, cy, 16, 26, 0, 0, Math.PI * 2)
    }
    ctx.stroke()
    if (!meiosis) {
      if (index === 0) {
        xShape(ctx, cx - 8, cy - 8)
        xShape(ctx, cx + 8, cy + 10)
      } else if (index === 1) {
        xShape(ctx, cx, cy - 12)
        xShape(ctx, cx, cy + 12)
      } else if (index === 2) {
        rod(ctx, cx - 12, cy)
        rod(ctx, cx + 12, cy)
      } else {
        rod(ctx, cx - 16, cy)
        rod(ctx, cx + 16, cy)
      }
    } else if (index === 0) {
      xShape(ctx, cx - 9, cy - 6, 7, INK.blue)
      xShape(ctx, cx + 6, cy - 6, 7, INK.red)
      xShape(ctx, cx - 4, cy + 14, 5, INK.blue)
      xShape(ctx, cx + 10, cy + 14, 5, INK.red)
    } else if (index === 1) {
      ink(ctx, INK.muted)
      ctx.save()
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(cx - 20, cy)
      ctx.lineTo(cx + 20, cy)
      ctx.stroke()
      ctx.restore()
      xShape(ctx, cx - 8, cy, 7, INK.blue)
      xShape(ctx, cx + 8, cy, 7, INK.red)
    } else if (index === 2) {
      xShape(ctx, cx - 14, cy - 2, 7, INK.blue)
      xShape(ctx, cx + 14, cy + 2, 7, INK.red)
    } else {
      xShape(ctx, cx - 16, cy, 5, INK.blue)
      xShape(ctx, cx + 16, cy, 5, INK.red)
    }
    textAt(ctx, name, cx, h * 0.74, 11)
  })
  textAt(ctx, meiosis ? 'cặp tương đồng tách, mỗi tế bào còn n' : 'chromatid tách, hai tế bào 2n', w / 2, h - 14, 11, '#64748b')
}

function nucleus(ctx: Ctx, x: number, y: number, r: number) {
  ink(ctx, INK.violet)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = '#ede9fe'
  ctx.fill()
  ctx.stroke()
  textAt(ctx, 'nhân', x, y, 11, INK.violet)
}

function mito(ctx: Ctx, x: number, y: number) {
  ink(ctx, INK.amber)
  ctx.beginPath()
  ctx.ellipse(x, y, 16, 9, 0.4, 0, Math.PI * 2)
  ctx.fillStyle = '#ffedd5'
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x, y, 16, 9, 0.4, 0, Math.PI * 2)
  ctx.moveTo(x - 8, y + 2)
  ctx.quadraticCurveTo(x, y - 5, x + 9, y + 2)
  ctx.stroke()
  textAt(ctx, 'ti thể', x, y + 18, 11, INK.amber)
}

function drawCell(ctx: Ctx, w: number, h: number, plant: boolean) {
  if (plant) {
    ink(ctx, INK.green)
    ctx.strokeRect(28, 22, w - 56, h - 48)
    ink(ctx, INK.sky)
    ctx.strokeRect(40, 34, w - 80, h - 72)
    ink(ctx, INK.sky)
    ctx.beginPath()
    ctx.ellipse(w * 0.6, h * 0.46, 40, 28, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#e0f2fe'
    ctx.fill()
    ctx.stroke()
    textAt(ctx, 'không bào', w * 0.6, h * 0.46, 11, INK.sky)
    textAt(ctx, 'thành', w * 0.5, 16, 11, INK.green)
    textAt(ctx, 'màng', 58, 52, 11, INK.sky)
    ink(ctx, INK.green)
    ctx.beginPath()
    ctx.ellipse(w * 0.3, h * 0.3, 18, 10, 0.3, 0, Math.PI * 2)
    ctx.fillStyle = '#bbf7d0'
    ctx.fill()
    ctx.stroke()
    textAt(ctx, 'lục lạp', w * 0.3, h * 0.18, 11, INK.green)
    nucleus(ctx, w * 0.24, h * 0.7, 15)
    mito(ctx, w * 0.78, h * 0.7)
    return
  }
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.ellipse(w / 2, h * 0.48, w * 0.36, h * 0.32, 0, 0, Math.PI * 2)
  ctx.stroke()
  nucleus(ctx, w * 0.42, h * 0.44, 20)
  mito(ctx, w * 0.66, h * 0.6)
}

function drawPedigree(ctx: Ctx, w: number, h: number) {
  const people: Array<[number, number, 'm' | 'f', boolean]> = [
    [w * 0.32, 40, 'm', false],
    [w * 0.62, 40, 'f', true],
    [w * 0.22, 110, 'f', false],
    [w * 0.48, 110, 'm', true],
    [w * 0.74, 110, 'f', false],
    [w * 0.36, 175, 'm', false],
    [w * 0.6, 175, 'f', true],
  ]
  ink(ctx, INK.muted)
  ctx.beginPath()
  ctx.moveTo(w * 0.32, 40)
  ctx.lineTo(w * 0.62, 40)
  ctx.moveTo(w * 0.47, 40)
  ctx.lineTo(w * 0.47, 70)
  ctx.lineTo(w * 0.22, 70)
  ctx.lineTo(w * 0.74, 70)
  ctx.moveTo(w * 0.22, 70)
  ctx.lineTo(w * 0.22, 110)
  ctx.moveTo(w * 0.48, 70)
  ctx.lineTo(w * 0.48, 110)
  ctx.moveTo(w * 0.74, 70)
  ctx.lineTo(w * 0.74, 110)
  ctx.moveTo(w * 0.48, 110)
  ctx.lineTo(w * 0.48, 140)
  ctx.lineTo(w * 0.36, 140)
  ctx.lineTo(w * 0.6, 140)
  ctx.moveTo(w * 0.36, 140)
  ctx.lineTo(w * 0.36, 175)
  ctx.moveTo(w * 0.6, 140)
  ctx.lineTo(w * 0.6, 175)
  ctx.stroke()
  for (const [x, y, sex, affected] of people) {
    const color = sex === 'm' ? INK.blue : INK.red
    ink(ctx, color)
    ctx.beginPath()
    if (sex === 'm') ctx.rect(x - 9, y - 9, 18, 18)
    else ctx.arc(x, y, 9, 0, Math.PI * 2)
    if (affected) ctx.fill()
    ctx.stroke()
  }
}

function drawPunnett(ctx: Ctx, w: number, h: number, test: boolean) {
  const alleles = test ? ['A', 'a'] : ['A', 'a']
  const top = test ? ['a', 'a'] : ['A', 'a']
  const x0 = w * 0.32
  const y0 = h * 0.28
  const cell = 48
  const alleleColor = (allele: string) => (allele === 'A' ? INK.blue : INK.amber)
  top.forEach((allele, index) => textAt(ctx, allele, x0 + cell * (index + 0.5), y0 - 16, 16, alleleColor(allele)))
  alleles.forEach((allele, index) => textAt(ctx, allele, x0 - 16, y0 + cell * (index + 0.5), 16, alleleColor(allele)))
  ink(ctx, INK.muted)
  for (let r = 0; r < 2; r += 1) {
    for (let c = 0; c < 2; c += 1) {
      ctx.strokeRect(x0 + c * cell, y0 + r * cell, cell, cell)
      const pretty = test
        ? (alleles[r] === 'A' ? 'Aa' : 'aa')
        : (alleles[r] === 'A' && top[c] === 'A' ? 'AA' : alleles[r] === 'a' && top[c] === 'a' ? 'aa' : 'Aa')
      const color = pretty === 'AA' ? INK.blue : pretty === 'aa' ? INK.amber : INK.green
      textAt(ctx, pretty, x0 + c * cell + cell / 2, y0 + r * cell + cell / 2, 14, color)
    }
  }
}

function drawMathGraph(ctx: Ctx, w: number, h: number, kind: string) {
  const ox = 48
  const oy = h * 0.72
  ink(ctx, INK.muted)
  arrow(ctx, ox, oy, w - 16, oy)
  arrow(ctx, ox + 40, h - 16, ox + 40, 16)
  const origin = ox + 40
  if (kind === 'line') {
    ink(ctx, INK.green)
    plotLine(ctx, [[origin - 20, oy + 30], [w - 30, oy - 90]])
    textAt(ctx, 'y = ax + b', w * 0.7, 28, 13, INK.green)
    return
  }
  if (kind === 'sine') {
    const pts: Array<[number, number]> = []
    for (let i = 0; i <= 40; i += 1) {
      const t = i / 40
      pts.push([origin + t * 180, oy - Math.sin(t * Math.PI * 2) * 50])
    }
    ink(ctx, INK.violet)
    plotLine(ctx, pts)
    textAt(ctx, 'y = sin x', w * 0.72, 28, 13, INK.violet)
    return
  }
  const pts: Array<[number, number]> = []
  for (let i = -8; i <= 8; i += 1) {
    const x = i * 14
    pts.push([origin + x, oy - (x * x) / 28])
  }
  ink(ctx, INK.blue)
  plotLine(ctx, pts)
  textAt(ctx, 'y = x²', w * 0.72, 28, 13, INK.blue)
}

function drawTrig(ctx: Ctx, w: number, h: number) {
  const cx = w * 0.4
  const cy = h * 0.5
  const r = Math.min(w * 0.3, h * 0.32)
  const font = Math.max(11, Math.round(r * 0.105))
  const theta = (42 * Math.PI) / 180
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  const tan = Math.tan(theta)
  const at = (angle: number, rad: number) => [cx + Math.cos(angle) * rad, cy - Math.sin(angle) * rad] as const
  const [mx, my] = at(theta, r)
  const hx = cx + cos * r

  ctx.save()
  ctx.fillStyle = '#e0f2fe'
  ctx.fillRect(cx, my, hx - cx, cy - my)
  ctx.restore()

  ink(ctx, INK.muted)
  ctx.lineWidth = 1.4
  arrow(ctx, cx - r - 26, cy, cx + r + 34, cy)
  arrow(ctx, cx, cy + r + 24, cx, cy - r - 26)
  textAt(ctx, 'x', cx + r + 42, cy - font * 0.7, font, INK.muted)
  textAt(ctx, 'y', cx + font, cy - r - 32, font, INK.muted)
  textAt(ctx, 'O', cx - font * 0.9, cy + font * 0.85, font, INK.text)

  ink(ctx, INK.sky)
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = 1.2
  const ticks: Array<[number, string, number, number]> = [
    [Math.PI / 6, 'π/6', -0.35, -1],
    [Math.PI / 3, 'π/3', 0.15, -1],
    [Math.PI / 2, 'π/2', 1.15, 0],
    [Math.PI, 'π', -1.2, 0.15],
    [(3 * Math.PI) / 2, '3π/2', 1.35, 0.2],
  ]
  for (const [mark, label, ox, oy] of ticks) {
    const [x0, y0] = at(mark, r - 5)
    const [x1, y1] = at(mark, r + 1)
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    const [lx, ly] = at(mark, r + font * 0.35)
    textAt(ctx, label, lx + ox * font, ly + oy * font, Math.max(10, font - 1), INK.sky)
  }

  ink(ctx, INK.green)
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(hx, cy)
  ctx.stroke()
  textAt(ctx, 'cos α', (cx + hx) / 2, cy + font + 3, font, INK.green)

  ink(ctx, INK.blue)
  ctx.setLineDash([4, 3])
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(mx, my)
  ctx.lineTo(hx, cy)
  ctx.moveTo(mx, my)
  ctx.lineTo(cx, my)
  ctx.stroke()
  ctx.setLineDash([])
  textAt(ctx, 'sin α', hx - font * 1.7, (my + cy) / 2, font, INK.blue)

  const mark = Math.max(7, r * 0.07)
  ink(ctx, INK.muted)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(hx - mark, cy)
  ctx.lineTo(hx - mark, cy - mark)
  ctx.lineTo(hx, cy - mark)
  ctx.stroke()

  ink(ctx, INK.amber)
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(mx, my)
  ctx.stroke()
  const [oneX, oneY] = at(theta, r * 0.48)
  textAt(ctx, '1', oneX - font * 0.7, oneY + font * 0.55, font, INK.amber)

  ink(ctx, INK.red)
  ctx.lineWidth = 1.5
  const arcR = r * 0.3
  ctx.beginPath()
  ctx.arc(cx, cy, arcR, 0, -theta, true)
  ctx.stroke()
  const [ax, ay] = at(theta, arcR)
  const dirX = -Math.sin(theta)
  const dirY = -Math.cos(theta)
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(ax - dirX * 7 - dirY * 3, ay - dirY * 7 + dirX * 3)
  ctx.moveTo(ax, ay)
  ctx.lineTo(ax - dirX * 7 + dirY * 3, ay - dirY * 7 - dirX * 3)
  ctx.stroke()
  const [alphaX, alphaY] = at(theta * 0.42, arcR + font)
  textAt(ctx, 'α', alphaX, alphaY, font, INK.red)

  const sense = (18 * Math.PI) / 180
  ink(ctx, INK.sky)
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.arc(cx, cy, r + 8, -(8 * Math.PI) / 180, -sense, true)
  ctx.stroke()
  const [sx, sy] = at(sense, r + 8)
  const sdx = -Math.sin(sense)
  const sdy = -Math.cos(sense)
  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(sx - sdx * 6 - sdy * 2.5, sy - sdy * 6 + sdx * 2.5)
  ctx.moveTo(sx, sy)
  ctx.lineTo(sx - sdx * 6 + sdy * 2.5, sy - sdy * 6 - sdx * 2.5)
  ctx.stroke()

  const tax = cx + r
  const tay = cy - r * tan
  ink(ctx, INK.violet)
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(tax, cy + r * 0.28)
  ctx.lineTo(tax, tay - 4)
  ctx.stroke()
  ctx.setLineDash([3, 3])
  ctx.beginPath()
  ctx.moveTo(mx, my)
  ctx.lineTo(tax, tay)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.arc(tax, tay, 2.6, 0, Math.PI * 2)
  ctx.fill()
  textAt(ctx, 'T', tax + font * 0.85, tay - font * 0.15, font, INK.violet)
  textAt(ctx, 'tan α', tax + font * 2.3, (cy + tay) / 2, font, INK.violet)

  const dot = (x: number, y: number, color: string) => {
    ink(ctx, color)
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  dot(cx, cy, INK.text)
  dot(mx, my, INK.amber)
  dot(hx, cy, INK.green)
  dot(cx, my, INK.blue)
  textAt(ctx, 'M', mx - font * 0.15, my - font, font, INK.amber)
  textAt(ctx, 'A(1;0)', cx + r, cy + font * 1.7, Math.max(10, font - 1), INK.sky)
  textAt(ctx, "A'(−1;0)", cx - r, cy + font * 1.7, Math.max(10, font - 1), INK.sky)
  textAt(ctx, 'B(0;1)', cx - font * 2.6, cy - r, Math.max(10, font - 1), INK.sky)
  textAt(ctx, "B'(0;−1)", cx - font * 2.8, cy + r, Math.max(10, font - 1), INK.sky)
  textAt(ctx, 'M(cos α; sin α)', cx + r * 0.15, h - font, font, INK.text)
}

function drawGeometry(ctx: Ctx, w: number, h: number, tangent: boolean) {
  if (!tangent) {
    ink(ctx, INK.text)
    poly(ctx, [[40, h - 40], [w - 50, h - 40], [40, 36]], true)
    ctx.save()
    ctx.strokeStyle = INK.red
    ctx.strokeRect(40, h - 40 - 16, 16, 16)
    ctx.restore()
    textAt(ctx, 'a', (40 + w - 50) / 2, h - 24, 13, INK.blue)
    textAt(ctx, 'b', 28, (h - 40 + 36) / 2, 13, INK.green)
    textAt(ctx, 'c', (40 + w - 50) / 2 - 10, (h - 40 + 36) / 2, 13, INK.amber)
    return
  }
  const cx = w * 0.4
  const cy = h * 0.55
  ink(ctx, INK.sky)
  ctx.beginPath()
  ctx.arc(cx, cy, 48, 0, Math.PI * 2)
  ctx.stroke()
  const ang = -0.7
  const px = cx + Math.cos(ang) * 48
  const py = cy + Math.sin(ang) * 48
  ink(ctx, INK.blue)
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(px, py)
  ctx.stroke()
  const tx = -Math.sin(ang)
  const ty = Math.cos(ang)
  ink(ctx, INK.amber)
  arrow(ctx, px - tx * 50, py - ty * 50, px + tx * 70, py + ty * 70)
  textAt(ctx, 'O', cx - 12, cy + 12, 12, INK.sky)
}

type FormulaCard = { spans: InkSpan[]; note?: string | InkSpan[] }

function formulaCard(bits: Array<[string, string]>, note: string | InkSpan[] = ''): FormulaCard {
  return { spans: bits.map(([text, color]) => ({ text, color })), note }
}

function paintFormula(ctx: Ctx, w: number, h: number, table: Record<string, FormulaCard>, kind: string, fallback: string) {
  const card = table[kind] ?? table[fallback]
  cardFormula(ctx, w, h, card.spans, card.note ?? '')
}

const MATH_FORMULAS: Record<string, FormulaCard> = {
  pythagoras: formulaCard([['a²', INK.blue], [' + ', INK.muted], ['b²', INK.green], [' = ', INK.muted], ['c²', INK.amber]], 'định lý Pythagore'),
  'square-sum': formulaCard([['(a + b)²', INK.blue], [' = ', INK.muted], ['a²', INK.green], [' + ', INK.muted], ['2ab', INK.amber], [' + ', INK.muted], ['b²', INK.violet]], 'hằng đẳng thức'),
  'square-diff': formulaCard([['(a − b)²', INK.blue], [' = ', INK.muted], ['a²', INK.green], [' − ', INK.muted], ['2ab', INK.amber], [' + ', INK.muted], ['b²', INK.violet]], 'hằng đẳng thức'),
  'diff-squares': formulaCard([['a² − b²', INK.blue], [' = ', INK.muted], ['(a − b)', INK.green], ['(a + b)', INK.amber]], 'hằng đẳng thức'),
  'cube-sum': formulaCard([['(a + b)³', INK.blue], [' = ', INK.muted], ['a³ + 3a²b + 3ab² + b³', INK.green]], 'hằng đẳng thức'),
  linear: formulaCard([['x', INK.blue], [' = ', INK.muted], ['−b', INK.amber], [' / ', INK.muted], ['a', INK.green]], 'ax + b = 0, a ≠ 0'),
  quadratic: formulaCard([
    ['x', INK.blue], [' = ', INK.muted], ['(−b', INK.amber], [' ± √', INK.muted], ['Δ', INK.green], [') / (', INK.muted], ['2a', INK.violet], [')', INK.muted],
  ], [{ text: 'Δ', color: INK.green }, { text: ' = b² − 4ac', color: INK.muted }]),
  vieta: formulaCard([['x₁ + x₂', INK.blue], [' = ', INK.muted], ['−b / a', INK.amber]], 'ax² + bx + c = 0; x₁x₂ = c / a'),
  identity: formulaCard([['sin²α', INK.green], [' + ', INK.muted], ['cos²α', INK.blue], [' = ', INK.muted], ['1', INK.amber]], 'hằng đẳng thức lượng giác'),
  'sin-sum': formulaCard([['sin(α + β)', INK.blue], [' = ', INK.muted], ['sin α cos β', INK.green], [' + ', INK.muted], ['cos α sin β', INK.amber]], 'công thức cộng'),
  tan: formulaCard([['tan α', INK.blue], [' = ', INK.muted], ['sin α', INK.green], [' / ', INK.muted], ['cos α', INK.amber]], 'cos α ≠ 0'),
  area: formulaCard([['S', INK.blue], [' = ', INK.muted], ['π', INK.amber], ['r²', INK.green]], 'diện tích hình tròn'),
  'tri-area': formulaCard([['S', INK.blue], [' = ', INK.muted], ['a', INK.green], [' · ', INK.muted], ['h', INK.amber], [' / ', INK.muted], ['2', INK.violet]], 'đáy a, đường cao h'),
  'tri-sin': formulaCard([['S', INK.blue], [' = ', INK.muted], ['½', INK.violet], ['ab', INK.green], [' sin ', INK.muted], ['C', INK.amber]], 'hai cạnh và góc xen giữa'),
  trapezoid: formulaCard([['S', INK.blue], [' = ', INK.muted], ['(a + b)', INK.green], [' · ', INK.muted], ['h', INK.amber], [' / ', INK.muted], ['2', INK.violet]], 'hai đáy a, b'),
  rect: formulaCard([['S', INK.blue], [' = ', INK.muted], ['a', INK.green], [' · ', INK.muted], ['b', INK.amber]], 'hình chữ nhật'),
  sphere: formulaCard([['V', INK.blue], [' = ', INK.muted], ['4/3', INK.violet], ['π', INK.amber], ['r³', INK.green]], 'hình cầu'),
  cylinder: formulaCard([['V', INK.blue], [' = ', INK.muted], ['π', INK.amber], ['r²', INK.green], ['h', INK.violet]], 'hình trụ'),
  cone: formulaCard([['V', INK.blue], [' = ', INK.muted], ['1/3', INK.violet], ['π', INK.amber], ['r²', INK.green], ['h', INK.sky]], 'hình nón'),
  distance: formulaCard([['d', INK.blue], [' = ', INK.muted], ['√[(x₂ − x₁)² + (y₂ − y₁)²]', INK.green]], 'hai điểm trên mặt phẳng'),
  slope: formulaCard([['k', INK.blue], [' = ', INK.muted], ['(y₂ − y₁)', INK.green], [' / ', INK.muted], ['(x₂ − x₁)', INK.amber]], 'hệ số góc đường thẳng'),
  'circle-eq': formulaCard([['(x − a)²', INK.blue], [' + ', INK.muted], ['(y − b)²', INK.green], [' = ', INK.muted], ['r²', INK.amber]], 'tâm (a; b), bán kính r'),
  arith: formulaCard([['uₙ', INK.blue], [' = ', INK.muted], ['u₁', INK.green], [' + ', INK.muted], ['(n − 1)d', INK.amber]], 'cấp số cộng'),
  geom: formulaCard([['uₙ', INK.blue], [' = ', INK.muted], ['u₁', INK.green], [' · ', INK.muted], ['qⁿ⁻¹', INK.amber]], 'cấp số nhân'),
  'sum-arith': formulaCard([['Sₙ', INK.blue], [' = ', INK.muted], ['n', INK.violet], ['(u₁ + uₙ)', INK.green], [' / ', INK.muted], ['2', INK.amber]], 'tổng n số hạng đầu'),
  log: formulaCard([['log(ab)', INK.blue], [' = ', INK.muted], ['log a', INK.green], [' + ', INK.muted], ['log b', INK.amber]], 'cùng cơ số; log(aⁿ) = n log a'),
  deriv: formulaCard([['(xⁿ)′', INK.blue], [' = ', INK.muted], ['n', INK.amber], ['xⁿ⁻¹', INK.green]], 'đạo hàm luỹ thừa'),
  integral: formulaCard([['∫ xⁿ dx', INK.blue], [' = ', INK.muted], ['xⁿ⁺¹', INK.green], [' / ', INK.muted], ['(n + 1)', INK.amber], [' + ', INK.muted], ['C', INK.violet]], 'n ≠ −1'),
  choose: formulaCard([['Cₙᵏ', INK.blue], [' = ', INK.muted], ['n!', INK.green], [' / ', INK.muted], ['[k!(n − k)!]', INK.amber]], '0 ≤ k ≤ n'),
  prob: formulaCard([['P(A)', INK.blue], [' = ', INK.muted], ['n(A)', INK.green], [' / ', INK.muted], ['n(Ω)', INK.amber]], 'biến cố đồng khả năng'),
}

function drawMathFormula(ctx: Ctx, w: number, h: number, kind: string) {
  paintFormula(ctx, w, h, MATH_FORMULAS, kind, 'pythagoras')
}

const PHYSICS_FORMULAS: Record<string, FormulaCard> = {
  velocity: formulaCard([['v', INK.blue], [' = ', INK.muted], ['s', INK.green], [' / ', INK.muted], ['t', INK.amber]], 'vận tốc trung bình'),
  accel: formulaCard([['a', INK.blue], [' = ', INK.muted], ['(v − v₀)', INK.green], [' / ', INK.muted], ['t', INK.amber]], 'gia tốc không đổi'),
  motion: formulaCard([['s', INK.blue], [' = ', INK.muted], ['v₀t', INK.green], [' + ', INK.muted], ['½at²', INK.amber]], 'v² = v₀² + 2as'),
  newton: formulaCard([['F', INK.blue], [' = ', INK.muted], ['m', INK.amber], ['a', INK.green]], 'định luật II Newton'),
  weight: formulaCard([['P', INK.blue], [' = ', INK.muted], ['m', INK.amber], ['g', INK.green]], 'trọng lượng'),
  momentum: formulaCard([['p', INK.blue], [' = ', INK.muted], ['m', INK.amber], ['v', INK.green]], 'động lượng'),
  work: formulaCard([['A', INK.blue], [' = ', INK.muted], ['F', INK.green], ['s', INK.amber], [' cos α', INK.violet]], 'α là góc giữa lực và độ dời'),
  power: formulaCard([['P', INK.blue], [' = ', INK.muted], ['A', INK.green], [' / ', INK.muted], ['t', INK.amber]], 'công suất'),
  kinetic: formulaCard([['Wđ', INK.blue], [' = ', INK.muted], ['½', INK.violet], ['m', INK.amber], ['v²', INK.green]], 'động năng'),
  potential: formulaCard([['Wt', INK.blue], [' = ', INK.muted], ['m', INK.amber], ['g', INK.green], ['h', INK.sky]], 'thế năng trọng trường'),
  friction: formulaCard([['Fms', INK.blue], [' = ', INK.muted], ['μ', INK.amber], ['N', INK.green]], 'ma sát trượt, N là phản lực pháp tuyến'),
  density: formulaCard([['ρ', INK.blue], [' = ', INK.muted], ['m', INK.amber], [' / ', INK.muted], ['V', INK.sky]], 'khối lượng riêng'),
  pressure: formulaCard([['p', INK.blue], [' = ', INK.muted], ['F', INK.green], [' / ', INK.muted], ['S', INK.amber]], 'áp suất'),
  ohm: formulaCard([['U', INK.blue], [' = ', INK.muted], ['I', INK.red], [' · ', INK.muted], ['R', INK.violet]], 'định luật Ohm'),
  series: formulaCard([['R', INK.blue], [' = ', INK.muted], ['R₁', INK.green], [' + ', INK.muted], ['R₂', INK.amber], [' + …', INK.muted]], 'mắc nối tiếp'),
  parallel: formulaCard([['1/R', INK.blue], [' = ', INK.muted], ['1/R₁', INK.green], [' + ', INK.muted], ['1/R₂', INK.amber], [' + …', INK.muted]], 'mắc song song'),
  current: formulaCard([['I', INK.blue], [' = ', INK.muted], ['q', INK.red], [' / ', INK.muted], ['t', INK.amber]], 'cường độ dòng điện'),
  joule: formulaCard([['Q', INK.blue], [' = ', INK.muted], ['I²', INK.red], ['R', INK.violet], ['t', INK.amber]], 'nhiệt lượng toả trên điện trở'),
  heat: formulaCard([['Q', INK.blue], [' = ', INK.muted], ['m', INK.amber], ['c', INK.green], ['Δt', INK.violet]], 'c là nhiệt dung riêng'),
  wave: formulaCard([['v', INK.blue], [' = ', INK.muted], ['λ', INK.amber], ['f', INK.green]], 'vận tốc truyền sóng'),
  frequency: formulaCard([['f', INK.blue], [' = ', INK.muted], ['1', INK.amber], [' / ', INK.muted], ['T', INK.green]], 'tần số và chu kỳ'),
  period: formulaCard([['T', INK.blue], [' = ', INK.muted], ['2π√(', INK.muted], ['l', INK.green], [' / ', INK.muted], ['g', INK.amber], [')', INK.muted]], 'con lắc đơn, góc nhỏ'),
  lens: formulaCard([['1/f', INK.blue], [' = ', INK.muted], ['1/d', INK.green], [' + ', INK.muted], ['1/d′', INK.amber]], 'd′ > 0 khi ảnh thật'),
  snell: formulaCard([['n₁ sin i', INK.blue], [' = ', INK.muted], ['n₂ sin r', INK.green]], 'i góc tới, r góc khúc xạ'),
  coulomb: formulaCard([['F', INK.blue], [' = ', INK.muted], ['k', INK.violet], ['|q₁q₂|', INK.red], [' / ', INK.muted], ['r²', INK.green]], 'lực tĩnh điện'),
  gas: formulaCard([['pV', INK.blue], [' = ', INK.muted], ['n', INK.green], ['R', INK.amber], ['T', INK.violet]], 'khí lí tưởng'),
  energy: formulaCard([['E', INK.amber], [' = ', INK.muted], ['m', INK.text], ['c²', INK.blue]], 'hệ thức Einstein'),
  efficiency: formulaCard([['H', INK.blue], [' = ', INK.muted], ['(Aᵢ', INK.green], [' / ', INK.muted], ['A)', INK.amber], [' · 100%', INK.violet]], 'Aᵢ là công có ích'),
}

function drawPhysicsFormula(ctx: Ctx, w: number, h: number, kind: string) {
  paintFormula(ctx, w, h, PHYSICS_FORMULAS, kind, 'newton')
}

const CHEM_FORMULAS: Record<string, FormulaCard> = {
  mole: formulaCard([['n', INK.blue], [' = ', INK.muted], ['m', INK.amber], [' / ', INK.muted], ['M', INK.violet]], 'lượng chất'),
  count: formulaCard([['n', INK.blue], [' = ', INK.muted], ['N', INK.green], [' / ', INK.muted], ['Nₐ', INK.amber]], 'Nₐ = 6,02×10²³ mol⁻¹'),
  volume: formulaCard([['n', INK.blue], [' = ', INK.muted], ['V', INK.sky], [' / ', INK.muted], ['Vₘ', INK.green]], 'Vₘ = 22,4 L/mol ở đktc'),
  conc: formulaCard([['C', INK.blue], [' = ', INK.muted], ['n', INK.green], [' / ', INK.muted], ['V', INK.sky]], 'nồng độ mol, V tính bằng lít'),
  percent: formulaCard([['C%', INK.blue], [' = ', INK.muted], ['(mct', INK.amber], [' / ', INK.muted], ['mdd)', INK.green], [' · 100%', INK.violet]], 'nồng độ phần trăm theo khối lượng'),
  convert: formulaCard([['Cₘ', INK.blue], [' = ', INK.muted], ['(10', INK.violet], [' · ', INK.muted], ['d', INK.amber], [' · ', INK.muted], ['C%)', INK.green], [' / ', INK.muted], ['M', INK.sky]], 'C% là số phần trăm, d tính bằng g/mL'),
  dilute: formulaCard([['C₁V₁', INK.blue], [' = ', INK.muted], ['C₂V₂', INK.green]], 'pha loãng, cùng chất tan'),
  density: formulaCard([['d', INK.blue], [' = ', INK.muted], ['m', INK.amber], [' / ', INK.muted], ['V', INK.sky]], 'khối lượng riêng dung dịch'),
  yield: formulaCard([['H', INK.blue], [' = ', INK.muted], ['(mtt', INK.green], [' / ', INK.muted], ['mlt)', INK.amber], [' · 100%', INK.violet]], 'hiệu suất phản ứng'),
  element: formulaCard([['%X', INK.blue], [' = ', INK.muted], ['(n', INK.green], [' · ', INK.muted], ['A', INK.amber], [' / ', INK.muted], ['M)', INK.violet], [' · 100%', INK.sky]], 'n số nguyên tử X, A nguyên tử khối'),
  ph: formulaCard([['pH', INK.blue], [' = ', INK.muted], ['−log', INK.muted], ['[H⁺]', INK.red]], 'độ axit'),
  poh: formulaCard([['pOH', INK.blue], [' = ', INK.muted], ['−log', INK.muted], ['[OH⁻]', INK.violet]], 'độ bazơ'),
  'ph-sum': formulaCard([['pH', INK.blue], [' + ', INK.muted], ['pOH', INK.violet], [' = ', INK.muted], ['14', INK.amber]], 'ở 25 °C'),
  kw: formulaCard([['[H⁺][OH⁻]', INK.blue], [' = ', INK.muted], ['10⁻¹⁴', INK.amber]], 'tích số ion của nước, 25 °C'),
  ka: formulaCard([['Kₐ', INK.blue], [' = ', INK.muted], ['[H⁺][A⁻]', INK.red], [' / ', INK.muted], ['[HA]', INK.green]], 'hằng số phân li axit'),
  buffer: formulaCard([['pH', INK.blue], [' = ', INK.muted], ['pKₐ', INK.amber], [' + ', INK.muted], ['log', INK.muted], ['(Cmuối', INK.green], [' / ', INK.muted], ['Caxit)', INK.violet]], 'dung dịch đệm axit'),
  rate: formulaCard([['v', INK.blue], [' = ', INK.muted], ['ΔC', INK.green], [' / ', INK.muted], ['Δt', INK.amber]], 'tốc độ trung bình'),
  kc: formulaCard([['Kc', INK.blue], [' = ', INK.muted], ['[C]ᶜ[D]ᵈ', INK.green], [' / ', INK.muted], ['[A]ᵃ[B]ᵇ', INK.amber]], 'aA + bB ⇌ cC + dD'),
  gas: formulaCard([['pV', INK.blue], [' = ', INK.muted], ['n', INK.green], ['R', INK.amber], ['T', INK.violet]], 'R = 0,082 L·atm/(mol·K) hoặc 8,31 J/(mol·K)'),
  electro: formulaCard([['m', INK.blue], [' = ', INK.muted], ['(A', INK.amber], [' · ', INK.muted], ['I', INK.red], [' · ', INK.muted], ['t)', INK.green], [' / ', INK.muted], ['(n', INK.violet], [' · ', INK.muted], ['F)', INK.sky]], 'n số electron, F hằng số Faraday'),
  alpha: formulaCard([['α', INK.blue], [' = ', INK.muted], ['n′', INK.green], [' / ', INK.muted], ['n₀', INK.amber]], 'độ điện li'),
  titrate: formulaCard([['CₐVₐ', INK.blue], [' = ', INK.muted], ['CᵦVᵦ', INK.green]], 'chuẩn độ axit–bazơ, tỉ lệ 1:1'),
}

function drawChemFormula(ctx: Ctx, w: number, h: number, kind: string) {
  paintFormula(ctx, w, h, CHEM_FORMULAS, kind, 'mole')
}

export function missingFormulaVariants(): string[] {
  const groups: Array<[string, Record<string, FormulaCard>]> = [
    ['math-formula', MATH_FORMULAS],
    ['formula-physics', PHYSICS_FORMULAS],
    ['formula-chem', CHEM_FORMULAS],
  ]
  const missing: string[] = []
  for (const [id, table] of groups) {
    for (const variant of figureItem(id)?.variants ?? []) {
      if (!table[variant.id]) missing.push(`${id}:${variant.id}`)
    }
  }
  return missing
}

function drawBioFormula(ctx: Ctx, w: number, h: number, growth: boolean) {
  const eq = { text: ' = ', color: INK.muted }
  if (growth) {
    cardFormula(ctx, w, h, [
      { text: 'Nₜ', color: INK.blue }, eq,
      { text: 'N₀', color: INK.green },
      { text: ' e^(', color: INK.muted },
      { text: 'rt', color: INK.amber },
      { text: ')', color: INK.muted },
    ], 'tăng trưởng mũ')
    return
  }
  cardFormula(ctx, w, h, [
    { text: 'p²', color: INK.blue },
    { text: ' + ', color: INK.muted },
    { text: '2pq', color: INK.green },
    { text: ' + ', color: INK.muted },
    { text: 'q²', color: INK.amber },
    eq,
    { text: '1', color: INK.text },
  ], 'Hardy–Weinberg, p + q = 1')
}

export function drawFigureLocal(ctx: Ctx, id: string, params: FigureParams, w: number, h: number, time = 0) {
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#1e293b'
  ctx.fillStyle = '#1e293b'
  ctx.lineWidth = 2
  const variant = params.variant
  if (id === 'math-formula') drawMathFormula(ctx, w, h, variant)
  else if (id === 'math-graph') drawMathGraph(ctx, w, h, variant)
  else if (id === 'math-trig') drawTrig(ctx, w, h)
  else if (id === 'spatial') drawSpatial(ctx, w, h, params.equation || (variant === 'saddle' ? 'x^2-y^2' : variant === 'ripple' ? 'sin(x)*cos(y)' : 'x^2+y^2'), time)
  else if (id === 'math-geometry') drawGeometry(ctx, w, h, variant === 'tangent')
  else if (id === 'circuit') drawCircuit(ctx, w, h, variant === 'parallel', params.tune, time)
  else if (id === 'force') drawForce(ctx, w, h, variant === 'incline', params.tune, params.run)
  else if (id === 'ray') drawRay(ctx, w, h, variant !== 'concave', params.tune, time)
  else if (id === 'phys-graph') drawPhysGraph(ctx, w, h, variant || 'vt')
  else if (id === 'wave') drawWave(ctx, w, h, variant || 'wave', time, params.tune)
  else if (id === 'field') drawField(ctx, w, h, variant || 'electric', time, params.tune)
  else if (id === 'law-graph') drawLaw(ctx, w, h, variant || 'decay')
  else if (id === 'refraction') drawRefraction(ctx, w, h, variant === 'prism', params.tune, time)
  else if (id === 'experiment-phys') drawExperiment(ctx, w, h, variant || 'projectile', time, params.tune)
  else if (id === 'interfere') drawInterfere(ctx, w, h, time, params.tune)
  else if (id === 'young') drawYoung(ctx, w, h, time, params.tune)
  else if (id === 'constants') drawConstants(ctx, w, h)
  else if (id === 'formula-physics') drawPhysicsFormula(ctx, w, h, variant)
  else if (id === 'equation') drawEquation(ctx, w, h, params.equation || 'H2 + O2 -> H2O')
  else if (id === 'structure') drawStructure(ctx, w, h, variant || 'water')
  else if (id === 'glass') drawGlass(ctx, w, h, params)
  else if (id === 'chem-scheme') drawScheme(ctx, w, h, variant || 'energy')
  else if (id === 'atom') drawAtom(ctx, w, h, variant || 'atom')
  else if (id === 'periodic') drawPeriodic(ctx, w, h, params.label)
  else if (id === 'titration') drawTitration(ctx, w, h, params, time)
  else if (id === 'chem-experiment') drawChemExperiment(ctx, w, h, variant || 'electro', params.tune, time)
  else if (id === 'formula-chem') drawChemFormula(ctx, w, h, variant)
  else if (id === 'bio-graph') drawBioGraph(ctx, w, h, variant !== 'exponential')
  else if (id === 'ecology') drawEcology(ctx, w, h, variant === 'pyramid')
  else if (id === 'genetic') drawGenetic(ctx, w, h, variant === 'codon')
  else if (id === 'division') drawDivision(ctx, w, h, variant === 'meiosis')
  else if (id === 'cell') drawCell(ctx, w, h, variant === 'plant')
  else if (id === 'pedigree') drawPedigree(ctx, w, h)
  else if (id === 'punnett') drawPunnett(ctx, w, h, variant === 'test')
  else if (id === 'formula-bio') drawBioFormula(ctx, w, h, variant === 'growth')
  else cardFormula(ctx, w, h, id, '')
  if (LAB_RUN.has(id)) playMark(ctx, w, params.run === true)
  ctx.restore()
}

function withTune(params: FigureParams, tune: number[]): FigureParams {
  return { ...params, tune }
}

function baseTune(params: FigureParams, count: number, defaults: number[]) {
  const next = defaults.slice(0, count)
  for (let i = 0; i < count; i += 1) {
    const value = params.tune?.[i]
    if (typeof value === 'number' && Number.isFinite(value)) next[i] = value
  }
  return next
}

function labHandles(figure: string, params: FigureParams, w: number, h: number, time: number) {
  const tune = params.tune
  const variant = params.variant
  if (figure === 'ray') {
    const scene = lensMetrics(w, h, variant !== 'concave', tune)
    return [{ id: 'object', x: scene.ox, y: scene.oy }]
  }
  if (figure === 'circuit') {
    const box = circuitLayout(w, h)
    const closed = tuneAt(tune, 0, 1) >= 0.5
    return [{ id: 'switch', x: box.switchX, y: closed ? box.yTop : box.yTop - 10 }]
  }
  if (figure === 'force' && variant === 'incline') {
    const x0 = 36
    const y0 = h - 28
    const run = w - 28 - x0
    const along = clampNum(tuneAt(tune, 0, 0.48), 0.22, 0.78)
    return [{ id: 'block', x: x0 + run * along, y: y0 - 108 * (1 - along) }]
  }
  if (figure === 'force') {
    const bx = clampNum(tuneAt(tune, 0, 0.42), 0.18, 0.7) * w
    return [{ id: 'block', x: bx + 35, y: h * 0.72 - 26 }]
  }
  if (figure === 'wave' && variant === 'spring') {
    const eq = springShift(h * 0.62, 18 / 210, h, tune, time)
    return [{ id: 'mass', x: w * 0.4, y: eq - 13 }]
  }
  if (figure === 'wave' && variant === 'osc') {
    const amp = clampNum(tuneAt(tune, 0, 0.16), 0.06, 0.32) * h
    return [{ id: 'amp', x: 50, y: h * 0.56 - amp }]
  }
  if (figure === 'wave') {
    const amp = clampNum(tuneAt(tune, 0, 0.17), 0.06, 0.32) * h
    return [{ id: 'amp', x: 56, y: h * 0.55 - amp }]
  }
  if (figure === 'field' && variant === 'wire') return [{ id: 'current', x: w * 0.5, y: h * 0.58 }]
  if (figure === 'field' && variant === 'magnet') {
    const xN = clampNum(tuneAt(tune, 0, 0.3), 0.08, 0.52) * w
    return [{ id: 'bar', x: xN + 50, y: h * 0.42 + 24 }]
  }
  if (figure === 'field') {
    const charges = chargePose(w, h, tune)
    return [{ id: 'plus', x: charges.x1, y: charges.y1 }, { id: 'minus', x: charges.x2, y: charges.y2 }]
  }
  if (figure === 'refraction' && variant !== 'prism') {
    const ray = snellPose(w, h, tune)
    return [{ id: 'ray', x: ray.x1, y: ray.y1 }]
  }
  if (figure === 'interfere') {
    const scene = waveTankLayout(w, h, tune)
    const handles: Array<{ id: string; x: number; y: number }> = [{ id: 's2', x: scene.s2.x, y: scene.s2.y }]
    for (const spot of [0.22, 0.5, 0.78]) {
      handles.push({ id: 'one', x: scene.panelX + scene.panelW * spot, y: scene.oneY })
      handles.push({ id: 'two', x: scene.panelX + scene.panelW * spot, y: scene.twoY })
    }
    return handles
  }
  if (figure === 'young') {
    const scene = youngLayout(w, h, tune)
    const handles: Array<{ id: string; x: number; y: number }> = [{ id: 'slit', x: scene.slitHandle.x, y: scene.slitHandle.y }]
    const step = Math.max(24, scene.screenH / 8)
    for (let y = scene.screenTop + 12; y <= scene.screenTop + scene.screenH - 8; y += step) {
      handles.push({ id: 'screen', x: scene.screenX + 10, y })
    }
    return handles
  }
  if (figure === 'experiment-phys' && variant === 'spring') {
    const eq = springShift(h * 0.58, 16 / 240, h, tune, time)
    return [{ id: 'mass', x: w * 0.46, y: eq - 13 }]
  }
  if (figure === 'experiment-phys' && variant === 'fall') {
    const start = clampNum(tuneAt(tune, 0, 36 / 240), 0.08, 0.62) * h
    return [{ id: 'drop', x: w * 0.5, y: start }]
  }
  if (figure === 'experiment-phys' && variant === 'pendulum') {
    const bob = pendulumPose(w, h, tune, time)
    return [{ id: 'bob', x: bob.bx, y: bob.by }]
  }
  if (figure === 'experiment-phys') {
    const shot = projectilePose(w, h, tune, time)
    return [{ id: 'launch', x: shot.hx, y: shot.hy }]
  }
  if (figure === 'chem-experiment' && variant === 'collect') return [{ id: 'react', x: w * 0.16, y: h * 0.48 }]
  if (figure === 'chem-experiment' && variant === 'heat') {
    const frac = clampNum(tuneAt(tune, 0, 0.42), 0.18, 0.72)
    return [{ id: 'flame', x: frac * w, y: h * 0.62 }]
  }
  if (figure === 'chem-experiment') {
    const button = electroButton(w, h)
    return [{ id: 'push', x: button.x, y: button.y - 14 }, { id: 'push', x: button.x, y: button.y - 34 }]
  }
  if (figure === 'titration') {
    const cock = titrationCock(w, h)
    return [{ id: 'valve', x: cock.x, y: cock.y }, { id: 'valve', x: w - 36, y: cock.y }]
  }
  return []
}

export function figureHandleAt(
  figure: string,
  params: FigureParams,
  w: number,
  h: number,
  local: { x: number; y: number },
  thresh: number,
  time = 0,
): string | null {
  const handles = labHandles(figure, params, w, h, time)
  if (LAB_RUN.has(figure)) {
    handles.push({ id: 'run', x: w - 18, y: 16 })
    handles.push({ id: 'run', x: w - 52, y: 16 })
  }
  let best: { id: string; d: number } | null = null
  for (const handle of handles) {
    const reach = handle.id === 'run' || handle.id === 'valve' || handle.id === 'push' || handle.id === 'one' || handle.id === 'two' || handle.id === 'screen' || handle.id === 'slit' ? Math.max(thresh, 18) : Math.max(thresh, 12)
    const d = Math.hypot(local.x - handle.x, local.y - handle.y)
    if (d <= reach && (!best || d < best.d)) best = { id: handle.id, d }
  }
  return best?.id ?? null
}

export function moveFigureTune(
  figure: string,
  params: FigureParams,
  w: number,
  h: number,
  handle: string,
  local: { x: number; y: number },
  time: number,
): FigureParams {
  const variant = params.variant
  if (figure === 'ray' && handle === 'object') {
    const fAbs = Math.max(40, Math.min(72, w * 0.155))
    const tune = baseTune(params, 2, [variant === 'concave' ? 1.71 : 2, variant === 'concave' ? 0.182 : 0.155])
    tune[0] = clampNum((w * 0.5 - local.x) / fAbs, 0.42, 2.75)
    tune[1] = clampNum((h * 0.56 - local.y) / h, -0.36, 0.38)
    return withTune(params, tune)
  }
  if (figure === 'circuit' && handle === 'switch') {
    const box = circuitLayout(w, h)
    return withTune(params, [local.y < box.yTop - 6 ? 0 : 1])
  }
  if (figure === 'force' && handle === 'block') {
    if (variant === 'incline') {
      const run = w - 28 - 36
      return withTune(params, [clampNum((local.x - 36) / run, 0.22, 0.78)])
    }
    return withTune(params, [clampNum((local.x - 35) / w, 0.18, 0.7)])
  }
  if (handle === 'mass') {
    const rest = figure === 'wave' ? h * 0.62 : h * 0.58
    const tune = baseTune(params, 3, [figure === 'wave' ? 18 / 210 : 16 / 240, time, 1])
    tune[0] = clampNum((local.y + 13 - rest) / h, -0.22, 0.22)
    tune[1] = time
    tune[2] = 1
    return withTune(params, tune)
  }
  if (figure === 'wave' && handle === 'amp') {
    const axis = variant === 'osc' ? h * 0.56 : h * 0.55
    return withTune(params, [clampNum((axis - local.y) / h, 0.06, 0.32)])
  }
  if (figure === 'field' && handle === 'current') return withTune(params, [local.x < w * 0.5 ? -1 : 1])
  if (figure === 'field' && handle === 'bar') return withTune(params, [clampNum((local.x - 50) / w, 0.08, 0.52)])
  if (figure === 'field' && (handle === 'plus' || handle === 'minus')) {
    const tune = baseTune(params, 4, [0.34, 0.5, 0.66, 0.5])
    const index = handle === 'plus' ? 0 : 2
    tune[index] = clampNum(local.x / w, handle === 'plus' ? 0.14 : 0.2, handle === 'plus' ? 0.8 : 0.88)
    tune[index + 1] = clampNum(local.y / h, 0.28, 0.78)
    return withTune(params, tune)
  }
  if (figure === 'refraction' && handle === 'ray') {
    const dx = w * 0.48 - local.x
    const dy = h * 0.48 - local.y
    if (dy <= 8) return params
    return withTune(params, [clampNum((Math.atan2(dx, dy) * 180) / Math.PI, 8, 72)])
  }
  if (figure === 'young' && handle === 'slit') {
    const scene = youngLayout(w, h, params.tune)
    const next = baseTune(params, 2, [0.18, 0.55])
    next[0] = clampNum((Math.abs(local.y - scene.midY) * 2) / scene.stage.h, 0.08, 0.28)
    return withTune(params, next)
  }
  if (figure === 'young' && handle === 'screen') {
    const scene = youngLayout(w, h, params.tune)
    const next = baseTune(params, 2, [0.18, 0.55])
    next[1] = clampNum((local.x - scene.slitX - scene.minL) / Math.max(1, scene.maxL - scene.minL), 0, 1)
    return withTune(params, next)
  }
  if (figure === 'interfere' && handle === 's2') {
    const scene = waveTankLayout(w, h, params.tune)
    const next = baseTune(params, 2, [0.2, 1])
    next[0] = clampNum((Math.abs(local.x - scene.midX) * 2) / scene.tray.w, 0.12, 0.34)
    return withTune(params, next)
  }
  if (figure === 'experiment-phys' && handle === 'bob') {
    const tune = baseTune(params, 3, [-0.46, time, 1])
    tune[0] = clampNum(Math.atan2(local.x - w * 0.58, local.y - 28), -1.15, 1.15)
    tune[1] = time
    tune[2] = 1
    return withTune(params, tune)
  }
  if (figure === 'experiment-phys' && handle === 'drop') return withTune(params, [clampNum(local.y / h, 0.08, 0.62)])
  if (figure === 'experiment-phys' && handle === 'launch') {
    const dx = local.x - 36
    const dy = h - 36 - local.y
    return withTune(params, [
      clampNum(Math.atan2(Math.max(8, dy), Math.max(8, dx)), 0.25, 1.3),
      clampNum(Math.hypot(dx, dy) / 80, 0.22, 0.92),
    ])
  }
  if (figure === 'chem-experiment' && handle === 'react') return withTune(params, [local.y < h * 0.4 ? 0 : 1])
  if (figure === 'chem-experiment' && handle === 'flame') return withTune(params, [clampNum(local.x / w, 0.18, 0.72)])
  if (figure === 'chem-experiment' && (handle === 'switch' || handle === 'push')) return params
  if (figure === 'titration' && (handle === 'valve' || handle === 'cock')) return params
  return params
}

export function releaseFigureTune(figure: string, params: FigureParams, handle: string, time: number): FigureParams {
  if (figure !== 'experiment-phys' && figure !== 'wave') return params
  if (handle !== 'bob' && handle !== 'mass') return params
  const tune = baseTune(params, 3, [handle === 'bob' ? -0.46 : 0.08, time, 0])
  tune[2] = 0
  tune[1] = time
  return withTune(params, tune)
}

export function drawWhiteboardFigure(
  ctx: Ctx,
  obj: { figure: string; params: FigureParams; x: number; y: number; w: number; h: number },
  cam: WhiteboardCamera,
  boardW: number,
  boardH: number,
  time = 0,
) {
  const scale = cam.scale || 1
  const origin = worldToScreen({ x: obj.x, y: obj.y }, cam, boardW, boardH)
  ctx.save()
  ctx.translate(origin.x, origin.y)
  ctx.scale(scale, scale)
  drawFigureLocal(ctx, obj.figure, obj.params, obj.w, obj.h, time)
  ctx.restore()
}
