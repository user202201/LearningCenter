#!/usr/bin/env python3
"""Writes src/data/coding-info.json: the content of the 编程 worlds 14-16 (信息科技: data and coding, networks / security / AI, devices).
Written by a model from memory (no textbook text); a 信息科技 teacher must proofread. Run: python3 scripts/make-coding-info.py
Lessons and scenario texts are content (shown in `user` boxes); titles and tasks have Chinese / English / French."""
import json, os

T = lambda zh, en, fr: [zh, en, fr]
lessons, acts, dev = {}, [], {}

def lesson(id, title, *steps):
    lessons[id] = {"title": title, "steps": [{"t": t, "d": d} for t, d in steps]}
def act(world, no, title, les, kind, spec, prompt=None, hints=None, boss=False):
    a = {"id": f"i{world}-{no:02d}", "world": world, "no": no, "title": title, "lesson": les, "kind": kind, "spec": spec}
    if prompt: a["prompt"] = prompt
    if hints: a["hints"] = hints
    if boss: a["boss"] = True
    acts.append(a)
txt = lambda *l: {"k": "text", "lines": list(l)}
flow = lambda *i: {"k": "flow", "items": list(i)}

# ======================= lessons: world 14 =======================
lesson("bin", T("二进制", "Binary", "Le binaire"),
  ("计算机里的开关只有两种状态：开（1）和关（0）。一排开关就可以表示数。", {"k": "bits", "bits": 4, "n": 5}),
  ("每一位有自己的“权重”：从右往左是 1、2、4、8……。把亮着的灯的权重加起来，就是十进制数。", {"k": "bits", "bits": 4, "n": 13}),
  ("反过来：要表示 11，先找不超过它的最大权重 8，剩下 3，再用 2 和 1。所以 11 = 1011。", txt("11 = 8 + 2 + 1", "8 → 1,  4 → 0,  2 → 1,  1 → 1", "11 = 1011")))
lesson("bytes", T("字节", "Bytes", "Les octets"),
  ("8 个二进制位组成 1 个字节。一个字节能表示 0 到 255。", {"k": "bits", "bits": 8, "n": 200}),
  ("权重是 128、64、32、16、8、4、2、1。全部点亮时是 255。", {"k": "bits", "bits": 8, "n": 255}))
lesson("binadd", T("二进制加法", "Binary addition", "Addition binaire"),
  ("二进制加法和十进制一样，从右往左逐位相加，只是“逢二进一”。", txt("0 + 0 = 0", "0 + 1 = 1", "1 + 1 = 10  （写 0，进 1）")),
  ("例：0101 + 0011。最右一位 1 + 1 = 10，写 0 进 1；下一位 0 + 1 + 进位 1 = 10，写 0 进 1……", txt("  0101", "+ 0011", "= 1000", "（5 + 3 = 8）")))
lesson("capacity", T("n 位能表示多少数", "How many values", "Combien de valeurs"),
  ("每多一位，能表示的数量就翻一倍：1 位 2 个，2 位 4 个，3 位 8 个。", txt("1 位: 2", "2 位: 4", "3 位: 8", "8 位: 256")),
  ("n 位二进制能表示 2 的 n 次方个不同的数，范围是 0 到 2ⁿ − 1。8 位：0 到 255。", txt("n 位 → 2ⁿ 个数", "最大的数 = 2ⁿ − 1")))
lesson("hex", T("十六进制", "Hexadecimal", "L'hexadécimal"),
  ("二进制太长，不好读。十六进制用 0-9 和 A-F（A=10 … F=15）表示 0 到 15，一个十六进制数字正好是 4 位二进制。", txt("1010 → A", "1111 → F", "0011 → 3")),
  ("一个字节写成两位十六进制：把 8 位分成两组，每组 4 位。例：11001010 → 1100 = C，1010 = A，所以是 CA。", txt("11001010", "1100 | 1010", "C     A", "CA = 12 × 16 + 10 = 202")))
lesson("ascii", T("字符编码", "Character codes", "Codage des caractères"),
  ("计算机只认识数字。为了存文字，大家约定：每个字符对应一个编号。ASCII 码用 0-127 表示英文字母、数字和符号。", txt("A → 65", "B → 66", "a → 97", "0 → 48")),
  ("一个单词就是一串编号。“CAT” = 67 65 84。大写字母和小写字母的编号相差 32。", txt("C   A   T", "67  65  84", "01000011 01000001 01010100")))
lesson("utf8", T("Unicode 与 UTF-8", "Unicode and UTF-8", "Unicode et UTF-8"),
  ("ASCII 装不下汉字。Unicode 给世界上几乎所有文字都编了号；UTF-8 是把这些编号存成字节的一种方法：英文字母 1 个字节，汉字通常 3 个字节。", txt("A  → 41", "你 → E4 BD A0", "好 → E5 A5 BD")),
  ("如果程序用错误的规则去读这些字节，就会出现乱码。同样的字节，换一张“码表”就变成别的字符。", txt("E4 BD A0  →  你  （UTF-8）", "E4 BD A0  →  ä½   （读错了）")))
lesson("pixels", T("图像的数字化", "Digital images", "Images numériques"),
  ("图片由很多小方格（像素）组成。黑白图片里，黑用 1，白用 0。一行 8 个像素就是一个 8 位二进制数。", {"k": "grid", "rows": ["00011000", "00111100", "01111110", "11111111", "00011000", "00011000", "00011000", "00011000"], "nums": True}),
  ("把每一行的二进制数换成十进制，整幅图就变成 8 个数字。有了这些数字，就能把图画出来。", txt("00011000 = 24", "00111100 = 60", "01111110 = 126", "11111111 = 255")))
lesson("rgb", T("彩色与 RGB", "Colour and RGB", "Couleur et RVB"),
  ("彩色屏幕用红（R）、绿（G）、蓝（B）三种光混合出各种颜色。每种光用 1 个字节（0-255）表示亮度。", txt("RGB(255, 0, 0) = 红", "RGB(0, 255, 0) = 绿", "RGB(255, 255, 0) = 黄", "RGB(255, 255, 255) = 白")),
  ("三个字节就是 24 位，一共能表示约 1677 万种颜色。常用十六进制写成 #RRGGBB，例如 #FF8000 是橙色。", txt("FF 80 00", "R=255 G=128 B=0")))
lesson("imgsize", T("分辨率与文件大小", "Resolution and size", "Résolution et taille"),
  ("分辨率是图片的像素数（宽 × 高）。像素越多越清晰，需要的存储也越多。颜色深度是每个像素用几位：黑白 1 位，灰度 8 位，真彩色 24 位。", txt("大小（字节）= 宽 × 高 × 位数 ÷ 8")),
  ("例：100 × 100 的真彩色图片：100 × 100 × 24 ÷ 8 = 30000 字节，约 29 KB。", txt("100 × 100 × 24 ÷ 8", "= 30000 字节")))
lesson("sampling", T("声音的数字化", "Digital sound", "Son numérique"),
  ("声音是连续变化的波。计算机每隔很短的时间量一次高度，这叫“采样”。每秒采样的次数叫采样率。", {"k": "wave", "rate": 6}),
  ("采样越密，越接近原来的波。采样太稀，会把声音还原错（音高变了）。采样率要超过声音最高频率的 2 倍，才能还原它。", {"k": "wave", "rate": 16}))
lesson("rle", T("游程编码", "Run-length coding", "Codage par plages"),
  ("数据里常有连续重复的内容。游程编码把“重复次数 + 内容”存起来，就能变短。", txt("AAAABBBCC", "→ 4A 3B 2C", "→ 4A3B2C  （9 个字符变成 6 个）")),
  ("没有重复时，游程编码反而更长：ABC → 1A1B1C。所以压缩要看数据的特点。", txt("ABC → 1A1B1C  （更长了）")))
lesson("huffman", T("哈夫曼编码", "Huffman coding", "Codage de Huffman"),
  ("出现多的字符用短编码，出现少的字符用长编码，整体就变短。哈夫曼树是这样做出来的：每次把权重最小的两个节点合并，直到只剩一棵树。", {"k": "flow", "items": ["C:1  D:1", "合并 = 2", "加入 R:2", "合并 = 4", "……", "一棵树"]}),
  ("从根出发，往左记 0，往右记 1，到达每个字符的路径就是它的编码。次数最多的 A 编码最短。", txt("A = 0", "B = 110", "R = 111", "C = 100", "D = 101")))
lesson("lossy", T("无损与有损压缩", "Lossless and lossy", "Avec et sans perte"),
  ("无损压缩（如 ZIP、PNG）：解压后和原来一模一样。有损压缩（如 JPEG、MP3）：去掉人不容易察觉的细节，文件小很多，但回不到原样。", txt("无损：文字、程序、PNG", "有损：照片 JPEG、音乐 MP3、视频")),
  ("选哪种取决于用途：合同和程序一个字节都不能错，必须无损；照片和音乐可以丢掉细节。", txt("文件不能错 → 无损", "只要看着、听着像 → 有损可以")))
lesson("caesar", T("凯撒密码", "Caesar cipher", "Le chiffre de César"),
  ("把每个字母按字母表向后移动固定的位数（密钥），就是凯撒密码。密钥是 3：A → D，B → E。", txt("明文 CAT", "密钥 3", "密文 FDW")),
  ("解密就是向前移回去。只有 25 种密钥，一个一个试就能破解，所以凯撒密码很不安全。", txt("FDW 向前移 3 位", "→ CAT")))
lesson("subst", T("替换密码与频率分析", "Substitution and frequency", "Substitution et fréquences"),
  ("替换密码把每个字母换成另一个固定的字母。密钥有 26!（约 4×10²⁶）种，不能一个个试。", txt("A→Q  B→W  C→E …")),
  ("但语言有规律：英文里 E 出现最多，其次是 T、A。数一数密文里每个字母出现的次数，最多的很可能是 E。这叫频率分析。", txt("密文里最多的字母 → 很可能是 E", "再根据常见单词 THE、AND 猜下去")))
lesson("xor", T("异或加密", "XOR", "Le OU exclusif"),
  ("异或（XOR）：两位相同得 0，不同得 1。用密钥和明文做一次异或得到密文。", txt("0 XOR 0 = 0", "0 XOR 1 = 1", "1 XOR 1 = 0")),
  ("神奇之处：用同一个密钥再异或一次，就变回明文。许多加密方法的基础就是它。", txt("明文  0110", "密钥  1010", "密文  1100", "再异或密钥 → 0110")))
lesson("parity", T("奇偶校验", "Parity", "Parité"),
  ("数据传输可能出错（0 变 1）。偶校验：在数据后面加 1 位，使整串里 1 的个数是偶数。接收方数一数，是奇数就知道出错了。", txt("数据 1011 有 3 个 1", "校验位 = 1", "发送 10111  （4 个 1）")),
  ("奇偶校验只能发现错误，不知道错在哪里，也发现不了“错了两位”。", txt("10111 → 收到 10011", "1 的个数是 3：有错！")))
lesson("ecc", T("纠错码", "Error correction", "Correction d'erreurs"),
  ("给数据排成方阵，每行每列都加一个校验位。一位出错时，出错的那一行和那一列都会“报错”，交叉处就是出错的位，翻转它就纠正了。", txt("行校验：第 3 行错", "列校验：第 2 列错", "交叉处 = 第 3 行第 2 列")),
  ("二维码、硬盘、卫星通信用的纠错码更强大，海明码是其中最简单的一种：用 3 个校验位检查 4 个数据位，并指出出错的位置。", txt("p1 p2 d1 p4 d2 d3 d4", "三个检查的结果合起来 = 出错的位置")))
lesson("checkdigit", T("校验码", "Check digits", "Chiffres de contrôle"),
  ("书的 ISBN、身份证号、银行卡号最后一位都是校验码，用前面的数字按规则算出来，可以发现输入错误。", txt("ISBN-13：权重 1 3 1 3 ……", "前 12 位加权求和，校验位使总和是 10 的倍数")),
  ("身份证第 18 位：前 17 位分别乘权重 7 9 10 5 8 4 2 1 6 3 7 9 10 5 8 4 2，求和后除以 11 取余，再按 1 0 X 9 8 7 6 5 4 3 2 对应。", txt("余数 0 → 1", "余数 2 → X", "余数 10 → 2")))
lesson("table", T("表格：排序与筛选", "Tables: sort and filter", "Tableaux : tri et filtre"),
  ("表格里的每一行是一条记录，每一列是一种信息。排序把行按某一列重新排列，筛选只留下满足条件的行。", {"k": "table", "head": ["姓名", "数学"], "rows": [["小华", 90], ["小明", 95], ["小红", 78]]}),
  ("先筛选、再排序，常常能很快找到答案，比如“数学不低于 90 的同学里，谁最高？”", txt("筛选：数学 ≥ 90", "排序：从高到低", "第一行就是答案")))
lesson("stats", T("平均数、中位数、众数", "Mean, median, mode", "Moyenne, médiane, mode"),
  ("平均数 = 总和 ÷ 个数。中位数：从小到大排好后正中间的数（个数是偶数时取中间两个的平均）。众数：出现次数最多的数。", txt("2 3 3 5 7", "平均 = 20 ÷ 5 = 4", "中位 = 3", "众数 = 3")),
  ("一个特别大的数会拉高平均数，但对中位数影响很小。看数据时，三个数一起看更可靠。", txt("2 3 3 5 100", "平均 = 22.6", "中位 = 3")))
lesson("charts", T("读图表", "Reading charts", "Lire les graphiques"),
  ("条形图用柱子的高度表示数量，先看标题和单位，再比较高矮。读数时从柱顶向左对准刻度。", {"k": "table", "head": ["", "小明", "小红", "小华"], "rows": [["数量", 8, 5, 3]]}),
  ("比较两个数量时，用大的减小的得到差。注意坐标轴是不是从 0 开始：不从 0 开始的图会让差别看起来更大。", txt("8 − 5 = 3")))
lesson("sheet", T("电子表格", "Spreadsheets", "Tableurs"),
  ("电子表格的格子用“列字母 + 行数字”命名，如 B2。以 = 开头的内容是公式，会自动计算；数据一变，结果跟着变。", txt("=B2+B3", "=SUM(B2:B5)", "=AVERAGE(B2:B5)")),
  ("常用函数：SUM 求和，AVERAGE 平均，MAX 最大，MIN 最小。B2:B5 表示从 B2 到 B5 的一片格子。公式里要用格子的名字，不要自己算好再填数字。", txt("=MAX(B2:B5)", "=B2*C2  （数量 × 单价）")))

# ======================= lessons: world 15 =======================
lesson("packets", T("数据包与路由", "Packets and routing", "Paquets et routage"),
  ("网络不会一次把整封信送出去。信息被切成许多小块，叫“数据包”，每块带有编号和目的地。", flow("HELLO WORLD", "HELL", "O WO", "RLD")),
  ("数据包经过一个个路由器，每个路由器把它转给下一个更近的路由器。每经过一个路由器，TTL（生存时间）减 1，减到 0 就被丢弃，防止数据包永远绕圈。", flow("电脑", "路由器 1", "路由器 2", "服务器")),
  ("数据包可能走不同的路线，到达的顺序也可能被打乱。接收方按编号重新排好，就还原出完整的信息。", txt("到达顺序: #3 #1 #2", "按编号排好: #1 #2 #3")))
lesson("web", T("输入网址之后", "Typing a web address", "Taper une adresse web"),
  ("在浏览器里输入网址，要经过一连串步骤：先找到服务器的 IP 地址，再连接，再请求，再显示。", flow("网址", "DNS 查 IP", "连接服务器", "HTTP 请求", "收到网页", "显示")),
  ("DNS 像一本电话簿：把容易记的名字（www.example.com）翻译成电脑使用的数字地址（IP 地址，如 93.184.216.34）。", txt("www.example.com", "→ DNS →", "93.184.216.34")))
lesson("proto", T("网络协议", "Protocols", "Protocoles"),
  ("协议就是通信双方事先约好的规则，像交通规则一样。TCP 在传数据前先“三次握手”，确认双方都准备好了。", flow("客户端：我想连接", "服务器：收到，我也准备好了", "客户端：收到", "开始传数据")),
  ("HTTP 是浏览器和服务器之间的对话：浏览器发出请求（GET），服务器回复响应（200 表示成功，404 表示找不到）。", txt("请求：GET /index.html", "响应：200 OK + 网页内容")))
lesson("ip", T("IP 地址", "IP addresses", "Adresses IP"),
  ("IPv4 地址由 4 个 0 到 255 的数字组成，用点隔开，如 192.168.1.10。每个数字是 1 个字节。", txt("192.168.1.10", "每段 0 – 255", "4 段 × 8 位 = 32 位")),
  ("256、300、−1 都不是合法的段；也不能多于或少于 4 段。", txt("192.168.1.300  ✗", "192.168.1      ✗", "192.168.1.1    ✓")))
lesson("password", T("安全的密码", "Safe passwords", "Mots de passe sûrs"),
  ("密码越长、字符种类越多，越难被猜到。破解程序会尝试每秒几十亿种组合。8 位纯数字几秒钟就能被试完；16 位混合字符要几亿年。", txt("123456 → 立刻", "xk8Q → 很快", "16 位混合 → 极其漫长")),
  ("好密码：长（至少 12 位）、混合大小写字母数字符号、不含生日和姓名、每个账号不一样。常见密码（123456、password）一秒就被猜出。", txt("✗ 123456", "✗ xiaoming2012", "✓ 好几个词 + 数字 + 符号")))
lesson("twostep", T("两步验证与保密", "Two-step verification", "Double authentification"),
  ("两步验证：除了密码，还要第二样东西（手机验证码、指纹）。即使密码泄露，坏人也进不去。", flow("输入密码", "输入手机验证码", "登录成功")),
  ("不要把密码和验证码告诉任何人，包括“客服”和“老师”。真正的机构不会向你索要验证码。", txt("验证码 = 钥匙", "不能发给别人")))
lesson("phishing", T("识别钓鱼和诈骗", "Spotting phishing", "Repérer l'hameçonnage"),
  ("钓鱼信息假装是银行、快递、朋友，骗你点链接或输入密码。常见特点：催你马上行动、有奖励或威胁、网址和官方不一样、要你提供验证码或密码。", txt("“您的账号将被冻结，点此链接！”", "→ 催促 + 陌生链接 = 可疑")),
  ("遇到可疑信息：不点链接、不回复、不给验证码；自己打开官方应用或打电话核实；告诉家长或老师。", txt("停一停 → 看一看 → 问一问")))
lesson("privacy", T("个人信息与隐私", "Personal data", "Données personnelles"),
  ("个人信息是能认出“你是谁”的信息：姓名、住址、电话、学校、照片、身份证号、账号密码。网上发出去的内容很难收回。", txt("能认出你 → 个人信息", "不能认出你 → 一般信息")),
  ("应用要求权限时想一想：它真的需要吗？手电筒不需要通讯录，游戏不需要麦克风。只给必要的权限。", txt("手电筒 → 相机闪光灯 ✓", "手电筒 → 通讯录 ✗")))
lesson("etiquette", T("网络礼仪与版权", "Etiquette and copyright", "Savoir-vivre et droit d'auteur"),
  ("网上和现实一样要尊重别人：不辱骂、不传谣、不未经同意发别人的照片。发言前想一想：当面我会这样说吗？", txt("发布前 → 想一想", "当面能说的才发")),
  ("别人的文章、图片、音乐、软件有版权。引用要注明出处；不能把别人的作品当作自己的；使用盗版软件是违法的。", txt("引用 → 写出处", "抄袭 ✗", "盗版 ✗")))
lesson("antivirus", T("病毒与防护", "Viruses and protection", "Virus et protection"),
  ("计算机病毒是会自己复制、破坏数据或偷信息的程序。常藏在来路不明的附件、盗版软件和可疑网站里。", txt("photo.jpg.exe  ← 真正的类型是 .exe", "invoice.pdf.exe  ← 同样可疑")),
  ("防护：安装可信的杀毒软件并更新、系统及时更新、不打开陌生附件、不装来源不明的软件、重要文件备份。杀毒软件扫描后会把可疑文件放进“隔离区”。", txt("扫描 → 隔离 → 删除")))
lesson("knn", T("机器怎样分类：近邻法", "Classifying by neighbours", "Classer par voisinage"),
  ("机器学习的一种简单方法：看新东西周围最近的几个已知的例子，哪一类多，就归哪一类。这叫 k 近邻（k 是看几个邻居）。", {"k": "points", "k2": 3}),
  ("k 太小（只看 1 个），容易被个别“怪点”误导；k 太大，又会把小团体忽略掉。", {"k": "points", "k2": 1}))
lesson("overfit", T("训练与测试", "Training and testing", "Entraînement et test"),
  ("机器要用“训练数据”来学习，用没见过的“测试数据”来检验。只在训练数据上全对，不代表学会了：可能只是把答案背下来了。", txt("训练准确率 100%", "测试准确率 80%", "→ 过拟合：背答案")),
  ("数据里常有错误和噪声。模型太“死记硬背”，会把噪声也学进去。合适的 k 通常在训练和测试之间取得平衡。", txt("k 小：贴合训练数据", "k 适中：测试更好")))
lesson("tree", T("决策树", "Decision trees", "Arbres de décision"),
  ("决策树像“猜动物”游戏：一连串是 / 否的问题，最后得出答案。", {"k": "tree", "root": {"q": "会飞吗？", "yes": {"a": "鸟"}, "no": {"q": "有毛吗？", "yes": {"a": "兽"}, "no": {"a": "鱼"}}}}),
  ("好问题能把混在一起的东西分得最干净。“信息增益”用来衡量一个问题让混乱减少了多少：越大越好；所有答案都一样的问题，增益为 0，毫无用处。", txt("问题 A：增益 0.97", "问题 B：增益 0.00  ✗")))
lesson("rules", T("规则与学习", "Rules and learning", "Règles et apprentissage"),
  ("人可以自己写规则：“如果 x 不小于 50，就是橙色”。规则简单，容易理解，但规则要靠人想出来。", txt("如果 x ≥ 50 → 橙色", "否则 → 蓝色")),
  ("当界线是斜的、弯的，或者有很多因素，人很难写出规则。机器可以从大量例子里自己找出规律，这就是机器学习。", {"k": "points", "k2": 3}))
lesson("search", T("搜索引擎原理", "How search works", "Comment fonctionne la recherche"),
  ("搜索引擎不会每次都把所有网页读一遍。它先建一个“倒排索引”：记下每个词出现在哪些网页里。", txt("词 → 出现在哪些网页", "猫 → 1, 3", "鱼 → 1, 2")),
  ("搜索多个词时，取各个词网页列表的交集：同时含有所有词的网页才是答案。", txt("猫 → 1, 3", "鱼 → 1, 2", "猫 + 鱼 → 1")))
lesson("bias", T("数据里的偏见", "Bias in data", "Biais dans les données"),
  ("机器从历史数据里学习。如果过去的决定对某一群人不公平，机器会把这种不公平学下来，并且继续重复。", txt("历史数据：B 组更难通过", "机器学到：B 组更难通过")),
  ("“把组别删掉”还不够：有些信息（比如地区）和组别高度相关，机器会用它们代替。要检查结果是否公平，而不只是是否准确。", txt("删掉“组别”，留下“地区”", "→ 偏见仍然存在")))
lesson("digit", T("图像识别", "Image recognition", "Reconnaissance d'images"),
  ("图像识别：把图片变成数字（每个像素的亮度），再和已知的例子比较。这里的小模型只认识 8 × 8 的数字。", {"k": "grid", "rows": ["00111100", "01100110", "00000110", "00011100", "00000110", "00000110", "01100110", "00111100"]}),
  ("机器会给出“把握”（置信度）。把握低时，说明它不确定。真实的识别系统也会出错，重要的决定不能只靠它。", txt("3：82%", "8：10%", "9：5%")))
lesson("genai", T("生成式人工智能", "Generative AI", "IA générative"),
  ("生成式人工智能（如聊天机器人、画图工具）是用大量文字和图片训练出来的，能写出看起来很像人写的文字。它预测的是“接下来最可能的内容”。", txt("输入：今天天气很……", "预测：好 / 热 / 冷 ……")),
  ("它可能一本正经地说错话，这叫“幻觉”。它没有生活经历，不会真的“知道”。使用时要核对重要信息，注明哪些内容是它生成的，不要用它代替自己思考。", txt("看起来流畅 ≠ 一定正确", "重要信息 → 核对")))

# ======================= lessons: world 16 =======================
lesson("scan", T("控制器的扫描周期", "The scan cycle", "Le cycle de scrutation"),
  ("自动化设备的“大脑”叫控制器。它不停地重复：读传感器 → 运行程序 → 控制执行器。每一轮叫一个周期。", flow("读传感器", "运行程序", "输出到执行器", "再来一轮")),
  ("这里的传感器和执行器都是变量。例如 light 是光线传感器的读数，lamp 是路灯（1 = 亮，0 = 灭）。用“如果 light < 30，就让 lamp = 1”来控制。", txt("如果 light < 30", "    lamp = 1", "否则 lamp = 0")))
lesson("timing", T("计时与状态", "Timers and state", "Minuterie et état"),
  ("控制器每一轮都会忘记什么吗？不会：变量会保留。用一个变量计数，就能“记住”过了多少轮，用它控制时间。", txt("每一轮：timer = timer + 1", "timer ≤ 4 → 绿灯", "timer = 5 → 黄灯", "之后 → 红灯，到 9 归零")),
  ("一个周期共 9 轮：绿灯 4 轮，黄灯 1 轮，红灯 4 轮。数到 9 以后把 timer 设回 0，周期就重新开始。每次只能亮一盏灯，要把另外两盏设为 0。", flow("timer 1-4：绿", "timer 5：黄", "timer 6-9：红", "归零")))
lesson("hyst", T("滞回：留一点余地", "Hysteresis", "Hystérésis"),
  ("如果光线刚好在 30 附近晃动，路灯就会一直闪。解决办法：天黑到 30 以下才开，天亮到 50 以上才关，中间保持不变。", txt("light < 30 → 开", "light > 50 → 关", "30 到 50 之间 → 保持")),
  ("恒温器、空调、冰箱都这样工作：低于下限开始加热，高于上限停止，避免开关太频繁。", txt("temp < 18 → 加热", "temp ≥ 22 → 停止")))
lesson("delay", T("延迟关闭", "Delayed closing", "Fermeture différée"),
  ("自动门不能一没人就立刻关，否则会夹到人。办法：没人后再等几轮才关。用一个计数变量 wait，有人时清零，没人时加 1。", txt("有人 → 开门, wait = 0", "没人 → wait = wait + 1", "wait ≥ 3 → 关门")),
  ("只有门开着的时候才需要等待。所以“没人”时先检查 door = 1，再让 wait 加 1。有人又出现时，wait 要清零，重新计时。", flow("有人：开门，wait = 0", "没人：wait + 1", "wait ≥ 3：关门")))
lesson("guard", T("保护条件", "Safety conditions", "Conditions de sécurité"),
  ("好的控制程序要先想“什么时候不能做”。水泵没有水时空转会烧坏。所以要检查水箱：水位为 0 就必须关泵，哪怕土壤很干。", txt("土壤干 → 开泵", "土壤湿 → 关泵", "水箱空 → 一定关泵")),
  ("保护规则写在最后：后面的规则会覆盖前面的结果。这样无论前面怎么决定，水箱空了泵一定是关的。", txt("1. soil < 30 → pump = 1", "2. soil ≥ 60 → pump = 0", "3. tank ≤ 0 → pump = 0  （最后，最优先）")))
lesson("logic", T("与、或", "AND and OR", "ET et OU"),
  ("报警条件常常有“并且”和“或者”：有烟，或者（有人移动并且门开着）。把所有可能的输入都列出来，叫真值表，可以检查没有漏掉。", txt("烟  动  门 → 报警", "0   0   0 → 0", "1   0   0 → 1", "0   1   1 → 1")),
  ("没有“与”的积木时，可以把两个开关相加：motion + door == 2 就表示两个都是 1。“或”可以写成相加 ≥ 1。", txt("motion + door == 2  → 与", "smoke + motion ≥ 1 → 或")))
lesson("edge", T("上升沿：只数一次", "Edges: count once", "Fronts : compter une fois"),
  ("传送带上的盒子经过传感器时，信号会持续好几轮。如果每轮都加 1，就把同一个盒子数了很多次。应该只在“从没有变成有”的那一轮数。", txt("信号: 0 0 1 1 0 0 1 1 0", "每轮都数 → 4 个（错）", "只数变化的那一轮 → 2 个（对）")),
  ("用一个变量 seen 记住“刚才有没有看见”：看见且 seen = 0 时才数一次，然后 seen = 1；没看见时 seen = 0。", txt("box = 1 且 seen = 0 → 计数 +1, seen = 1", "box = 0 → seen = 0")))
lesson("countdown", T("倒计时与状态机", "Countdowns and state machines", "Comptes à rebours"),
  ("有的设备有几种“状态”：空闲、倒计时中、响铃中。程序要先判断现在处于哪种状态，再决定做什么。", flow("空闲", "按键 → 倒计时", "到 0 → 响铃", "响完 → 空闲")),
  ("倒计时中按键应该被忽略。用变量 running 记住状态：running = 1 时不接受新的按键。", txt("running = 0 → 等待按键", "running = 1 → 数数，忽略按键")))
lesson("fsm", T("密码锁的状态", "A keypad lock", "Un digicode"),
  ("密码锁要记住“已经输对了几位”。用变量 state：每输对一位加 1，输错就归零并记一次错误；错误满 3 次报警。", flow("state 0", "按对 2 → 1", "按对 5 → 2", "按对 8 → 开锁")),
  ("先算出“这一步应该按哪个键”，再和实际按的键比较，比写一大堆嵌套的判断更清楚。", txt("state 0 → 想要 2", "state 1 → 想要 5", "state 2 → 想要 8")))
lesson("lift", T("请求队列", "A queue of requests", "File de demandes"),
  ("电梯按先来先服务的顺序处理请求。传感器 target 是最早的未完成请求（0 表示没有）。比较 target 和当前楼层 floor，决定上行、下行或停止。", txt("target > floor → 上", "target < floor → 下", "target = 0 → 不动")),
  ("注意：没有请求时 target = 0，0 比任何楼层都小，如果只写“小于就下行”，电梯会一直往下冲。要先排除 0。", txt("先检查 target ≠ 0", "再比较大小")))
lesson("follow", T("巡线小车", "A line follower", "Un suiveur de ligne"),
  ("小车底部有左、右两个传感器，看见黑线时为 1。左边看见线，说明线在左边，车要向左转；右边看见线，向右转；都看不见，说明在线上，直行。", txt("left = 1 → 向左 (steer = −1)", "right = 1 → 向右 (steer = 1)", "都是 0 → 直行 (steer = 0)")),
  ("先把 steer 设为 0，再用两条规则修正。每一轮小车都重新读传感器，一点一点把自己拉回线上，这叫“反馈”。", flow("读传感器", "线在哪边？", "往那边转", "再读传感器")))
lesson("follow2", T("按偏差大小转向", "Proportional steering", "Direction proportionnelle"),
  ("线弯得很急时，每次只转一点点就追不上。增加两个更靠外的传感器：线偏得越远，转得越大。这就是“比例控制”的思想：偏差越大，修正越大。", txt("近的传感器 → 转 1", "远的传感器 → 转 3")),
  ("规则的顺序有讲究：先写小的修正，再写大的修正。两个传感器同时看见线时，后面的大修正会覆盖前面的小修正。", txt("1. left → −1  right → 1", "2. farleft → −3  farright → 3", "后写的优先")))
lesson("rover", T("避障", "Avoiding obstacles", "Éviter les obstacles"),
  ("超声波传感器测量前方障碍物的距离 dist。距离还远时全速前进；距离很近时先停下，再换到另一条车道。别忘了留出足够的刹车距离：每次走 3，停止的距离要大于 3。", txt("dist < 12 → 停止并变道", "否则 → 速度 3")))
lesson("arm", T("机械臂", "A robot arm", "Un bras robotique"),
  ("机械臂的底座转动角度 base，爪子 claw（0 张开，1 闭合）。取放物体要分几步：转到物体上方 → 闭合 → 转到目标位置 → 张开。每一步用传感器判断是否到位。", flow("张开，寻找物体", "看见物体：闭合", "转回投放区", "到了：张开")))
lesson("schedule", T("错峰用电", "Scheduling", "Planification"),
  ("电价有高低。把洗衣机安排在便宜的时段运行，可以省钱。程序要保证：只在便宜时段运行，一共运行 3 个小时。用变量 used 记住已经运行了几个小时。", txt("price = 0 且 used < 3 → 洗衣机开", "used = used + 1")))

# ======================= prompts of the generators =======================
gp = {
 "binRead": T("灯亮着是 1，灭着是 0。这个二进制数是多少（十进制）？", "A lit lamp is 1, an unlit lamp is 0. What is this binary number in decimal?", "Lampe allumée = 1, éteinte = 0. Quel est ce nombre binaire en décimal ?"),
 "binWrite": T("用开关表示十进制数 {0}。", "Set the switches to show the decimal number {0}.", "Réglez les interrupteurs pour représenter le nombre décimal {0}."),
 "binAdd": T("二进制加法：{0} + {1}。用开关写出和。", "Binary addition: {0} + {1}. Set the switches to the sum.", "Addition binaire : {0} + {1}. Réglez les interrupteurs sur la somme."),
 "capacity": T("{0} 个二进制位一共能表示多少个不同的数（包括 0）？", "How many different values (including 0) can {0} bits store?", "Combien de valeurs différentes (0 compris) peut-on stocker avec {0} bits ?"),
 "bitsFor": T("要存下 0 到 {0} 的任何一个整数，至少需要几个二进制位？", "At least how many bits are needed to store any integer from 0 to {0}?", "Combien de bits faut-il au minimum pour stocker tout entier de 0 à {0} ?"),
 "hexRead": T("十六进制数 {0} 等于十进制多少？", "What is the hexadecimal number {0} in decimal?", "Que vaut le nombre hexadécimal {0} en décimal ?"),
 "hexWrite": T("把十进制数 {0} 写成十六进制（两位，字母大写）。", "Write the decimal number {0} in hexadecimal (two digits, capital letters).", "Écrivez le nombre décimal {0} en hexadécimal (deux chiffres, majuscules)."),
 "hexBin": T("十六进制数字 {0} 对应的 4 位二进制是什么？", "Which 4 bits correspond to the hexadecimal digit {0}?", "Quels 4 bits correspondent au chiffre hexadécimal {0} ?"),
 "asciiCode": T("字母 {0} 的 ASCII 码（十进制）是多少？", "What is the ASCII code (decimal) of the letter {0}?", "Quel est le code ASCII (décimal) de la lettre {0} ?"),
 "asciiChar": T("ASCII 码 {0} 是哪个字母？", "Which letter has the ASCII code {0}?", "Quelle lettre a le code ASCII {0} ?"),
 "encodeWord": T("写出单词 {0} 每个字母的 ASCII 码（十进制，每个字母一格）。", "Write the ASCII code (decimal) of each letter of the word {0}, one box per letter.", "Écrivez le code ASCII (décimal) de chaque lettre du mot {0}, une case par lettre."),
 "decodeWord": T("这些 ASCII 码表示哪个单词？{0}", "Which word do these ASCII codes spell? {0}", "Quel mot ces codes ASCII forment-ils ? {0}"),
 "utf8Len": T("字符 {0} 用 UTF-8 编码需要几个字节？", "How many bytes does the character {0} need in UTF-8?", "Combien d'octets le caractère {0} demande-t-il en UTF-8 ?"),
 "utf8Hex": T("汉字 {0} 的 UTF-8 编码是哪几个字节？（十六进制，每个字节一格）", "Which bytes are the UTF-8 code of {0}? (hexadecimal, one box per byte)", "Quels octets forment le code UTF-8 de {0} ? (hexadécimal, une case par octet)"),
 "imgSize": T("一幅 {0} × {1} 的图片，每个像素用 {2} 位，一共需要多少字节？", "A picture of {0} × {1} pixels, {2} bits per pixel: how many bytes in all?", "Une image de {0} × {1} pixels, {2} bits par pixel : combien d'octets au total ?"),
 "colorName": T("颜色 RGB({0}) 是什么颜色？", "Which colour is RGB({0})?", "Quelle est la couleur RVB({0}) ?"),
 "rleEnc": T("用游程编码（次数 + 字符）压缩 {0}。", "Compress {0} with run-length coding (count + character).", "Compressez {0} par plages (nombre + caractère)."),
 "rleDec": T("还原游程编码 {0}。", "Decode the run-length code {0}.", "Décodez le code par plages {0}."),
 "rleSize": T("{0} 压缩成 {1}。压缩后的长度比原来……", "{0} is compressed to {1}. The compressed length is ...", "{0} devient {1}. La longueur compressée est ..."),
 "caesarDec": T("凯撒密码：每个字母向后移了 {1} 位。请解密 {0}。", "Caesar cipher: every letter was moved {1} places forward. Decrypt {0}.", "Chiffre de César : chaque lettre a avancé de {1} rangs. Déchiffrez {0}."),
 "caesarBreak": T("密文是 {0}，密钥未知。请转动轮盘，破解它。", "The ciphertext is {0}, the key is unknown. Turn the wheel and break it.", "Le texte chiffré est {0}, la clé est inconnue. Tournez la roue et déchiffrez-le."),
 "caesarEnc": T("把 {0} 向后移 {1} 位，写出密文。", "Move {0} forward by {1} places and write the ciphertext.", "Avancez {0} de {1} rangs et écrivez le texte chiffré."),
 "xor": T("异或：{0} XOR {1} = ？（相同得 0，不同得 1）", "XOR: {0} XOR {1} = ? (same gives 0, different gives 1)", "OU exclusif : {0} XOR {1} = ? (identiques : 0, différents : 1)"),
 "xorBack": T("密文是 {0}，密钥是 {1}。再异或一次，明文是什么？", "The ciphertext is {0}, the key is {1}. XOR once more: what is the plaintext?", "Le texte chiffré est {0}, la clé est {1}. Refaites un XOR : quel est le texte clair ?"),
 "parity": T("数据位是 {0}。偶校验位应该是 0 还是 1？", "The data bits are {0}. Should the even-parity bit be 0 or 1?", "Les bits de données sont {0}. Le bit de parité paire doit-il valoir 0 ou 1 ?"),
 "parityCheck": T("收到 {0}（最后一位是偶校验位）。传输正确吗？", "Received {0} (the last bit is the even-parity bit). Is the transmission correct?", "Reçu {0} (le dernier bit est le bit de parité paire). La transmission est-elle correcte ?"),
 "isbn": T("ISBN-13 的前 12 位是 {0}。校验位是多少？（权重 1、3 交替；总和加上校验位是 10 的倍数）", "The first 12 digits of an ISBN-13 are {0}. What is the check digit? (weights 1, 3 alternating; the total with the check digit is a multiple of 10)", "Les 12 premiers chiffres d'un ISBN-13 sont {0}. Quel est le chiffre de contrôle ? (poids 1, 3 en alternance ; le total avec le chiffre de contrôle est un multiple de 10)"),
 "idcard": T("身份证号前 17 位是 {0}。第 18 位校验码是什么？（权重 7 9 10 5 8 4 2 1 6 3 7 9 10 5 8 4 2，求和除以 11 取余，余数 0-10 对应 1 0 X 9 8 7 6 5 4 3 2）", "The first 17 digits of an ID number are {0}. What is the 18th check character? (weights 7 9 10 5 8 4 2 1 6 3 7 9 10 5 8 4 2; sum, remainder modulo 11; remainders 0-10 map to 1 0 X 9 8 7 6 5 4 3 2)", "Les 17 premiers chiffres d'un numéro d'identité sont {0}. Quel est le 18e caractère de contrôle ? (poids 7 9 10 5 8 4 2 1 6 3 7 9 10 5 8 4 2 ; somme, reste modulo 11 ; les restes 0-10 donnent 1 0 X 9 8 7 6 5 4 3 2)"),
 "mean": T("求这组数的平均数。", "Find the mean of these numbers.", "Calculez la moyenne de ces nombres."),
 "median": T("求这组数的中位数。", "Find the median of these numbers.", "Calculez la médiane de ces nombres."),
 "mode": T("求这组数的众数（出现次数最多的数）。", "Find the mode of these numbers (the most frequent one).", "Trouvez le mode de ces nombres (le plus fréquent)."),
 "barRead": T("{0} 的数值是多少？", "What is the value of {0}?", "Quelle est la valeur de {0} ?"),
 "barMax": T("谁的数值最大？", "Whose value is the largest?", "Quelle valeur est la plus grande ?"),
 "barDiff": T("{0} 和 {1} 相差多少？", "What is the difference between {0} and {1}?", "Quelle est la différence entre {0} et {1} ?"),
 "ip": T("{0} 是合法的 IPv4 地址吗？", "Is {0} a valid IPv4 address?", "{0} est-elle une adresse IPv4 valide ?"),
 "entropy": T("一个随机密码长 {0} 位，每一位有 {1} 种可能。它的强度约是多少比特？（长度 × log₂ 种数，四舍五入）", "A random password is {0} characters long, each with {1} possibilities. About how many bits of strength? (length × log2 of the possibilities, rounded)", "Un mot de passe aléatoire a {0} caractères, chacun avec {1} possibilités. Environ combien de bits de force ? (longueur × log2 des possibilités, arrondi)"),
 "reassemble": T("数据包到达的顺序被打乱了。请按编号 1、2、3 …… 依次点击，还原信息。", "The packets arrived in a shuffled order. Tap them in the order of their numbers to rebuild the message.", "Les paquets sont arrivés dans le désordre. Touchez-les dans l'ordre de leurs numéros pour reconstituer le message."),
}
labels = {k: T(a, b, c) for k, (a, b, c) in {
 "yes": ("是", "Yes", "Oui"), "no": ("不是", "No", "Non"), "ok": ("正确", "Correct", "Correct"), "error": ("有错误", "Errors", "Erreurs"),
 "shorter": ("更短", "Shorter", "Plus court"), "longer": ("更长", "Longer", "Plus long"),
 "red": ("红色", "Red", "Rouge"), "green": ("绿色", "Green", "Vert"), "blue": ("蓝色", "Blue", "Bleu"), "yellow": ("黄色", "Yellow", "Jaune"),
 "black": ("黑色", "Black", "Noir"), "white": ("白色", "White", "Blanc"), "cyan": ("青色", "Cyan", "Cyan"), "magenta": ("品红色", "Magenta", "Magenta")}.items()}
kindHints = {
 "quiz": ["再读一遍题目，把已知的数字写下来。", "把题目分成小步，一步一步算。", "做完后检查：答案的格式（大小写、位数）对吗？"],
 "bits": ["从最大的权重开始：能减就减，把对应的开关打开。", "每个开关的权重写在上面：8、4、2、1。把亮着的权重加起来，应该等于目标。", "做完用左下角的“= 数”核对。"],
 "scenario": ["先想：这样做会带来什么后果？", "想一想：真正的机构会这样要求你吗？", "选择最安全、最负责任的做法。"],
 "sort": ["先放最有把握的卡片。", "逐个检查卡片的特点：来源、语气、要求你做什么。", "放错的卡片会被退回，再看一看它的特征。"],
 "order": ["先想哪一步是第一步，哪一步是最后一步。", "每一步都要依靠前一步的结果。", "用 ▲ ▼ 或拖动调整位置。"],
 "pick": ["先扫描，看每个文件的风险。", "注意文件名：假装成图片的程序、来历不明的附件。", "正常的文件不要隔离。"],
 "pixel": ["黑色是 1，白色是 0。一行就是一个 8 位二进制数。", "一行一行来：从左到右看每个格子。", "做完对照一遍每一行。"],
 "rgbmix": ["R 是红，G 是绿，B 是蓝。数值越大越亮。", "先调主要的颜色，再微调。", "两个颜色块越像越好。"],
 "wave": ["点一点不同的采样率，看圆点把波连起来像不像。", "采样率要超过声音频率的 2 倍。", "点“听一听”，音高变了就说明太稀了。"],
 "huff": ["每次只看权重最小的两个节点。", "合并后得到的新节点权重是两者之和，它也参与下一轮。", "有两个同样小的时候，任选一个都可以。"],
 "subst": ["数一数密文里每个字母出现的次数，最多的很可能是 E。", "三个字母的单词常常是 THE 或 AND。", "已经确定的字母会同时出现在所有位置。"],
 "fixbit": ["出错的那一行和那一列会标出来：看它们的交叉处。", "数一数每行每列里 1 的个数是奇数还是偶数。", "点击出错的那一位。"],
 "sheet": ["公式要以 = 开头，用格子的名字，如 B2。", "SUM、AVERAGE、MAX 后面的括号里写范围，如 B2:B5。", "不要自己算好再填数字：数据一变，公式才会跟着变。"],
 "table": ["点表头可以排序，再点一次反过来。", "筛选：选好列、条件，再输入数字。", "按任务一步一步做。"],
 "route": ["每次只能走到有连线的相邻节点。", "红色虚线表示堵住了，换一条路。", "TTL 是最多能走的步数。"],
 "password": ["长度比花样更重要：至少 12 位。", "混合大写、小写、数字和符号。", "几个不相关的词加数字和符号，容易记又够长。"],
 "knn": ["看新点周围最近的几个点是什么颜色。", "k 越大，边界越平滑。", "比较训练准确率和测试准确率。"],
 "tree": ["选能把动物分得最干净的问题。", "每个问题后面会显示信息增益：越大越好。", "答案全都一样的问题没有用。"],
 "rules": ["拖动滑块，让虚线把两种颜色分开。", "边界是斜线时，一条直线分不干净。", "比较两个准确率。"],
 "search": ["每个词先找出它出现的网页。", "多个词：必须同时含有全部的词。", "逐个网页检查。"],
 "bias": ["先看上面的表：同样的分数，两组被通过的比例一样吗？", "哪些信息会泄露组别？", "分数是必需的，其余信息要小心。"],
 "digit": ["把数字画得大一点、清楚一点。", "笔画要连起来，别画得太细碎。", "看置信度：越高机器越有把握。"],
}
dev_hints_default = ["先写出“如果……就……”的规则，再搭积木。", "测试里失败的场景会自动显示在左边，看它出了什么问题。"]

# ======================= activities: world 14 =======================
W = 14
act(W, 1, T("二进制开关", "Binary switches", "Interrupteurs binaires"), "bin", "bits", {"mode": "dec2bin", "bits": 4, "rounds": 3})
act(W, 2, T("数一数二进制灯", "Reading binary lamps", "Lire des lampes binaires"), "bin", "quiz", {"gen": "binRead", "bits": 4, "n": 4})
act(W, 3, T("八位二进制", "Eight bits", "Huit bits"), "bytes", "bits", {"mode": "dec2bin", "bits": 8, "rounds": 3})
act(W, 4, T("二进制加法", "Binary addition", "Addition binaire"), "binadd", "bits", {"mode": "add", "bits": 4, "rounds": 3})
act(W, 5, T("n 位能存多少", "What n bits can store", "Ce que n bits peuvent stocker"), "capacity", "quiz", {"gen": "capacity", "n": 3})
act(W, 6, T("需要几位", "How many bits", "Combien de bits"), "capacity", "quiz", {"gen": "bitsFor", "n": 4})
act(W, 7, T("十六进制", "Hexadecimal", "Hexadécimal"), "hex", "quiz", {"gen": ["hexBin", "hexRead", "hexWrite"], "n": 6})
act(W, 8, T("ASCII 码", "ASCII codes", "Codes ASCII"), "ascii", "quiz", {"gen": ["asciiCode", "asciiChar"], "n": 4})
act(W, 9, T("编码一个单词", "Encoding a word", "Coder un mot"), "ascii", "quiz", {"gen": ["encodeWord", "decodeWord"], "n": 4})
act(W, 10, T("UTF-8 与汉字", "UTF-8 and Chinese characters", "UTF-8 et caractères chinois"), "utf8", "quiz", {"gen": ["utf8Len", "utf8Hex"], "n": 4})
act(W, 11, T("画一幅黑白画", "A black-and-white picture", "Une image noir et blanc"), "pixels", "pixel", {"mode": "paint", "pic": "heart"}, T("照着目标图把方格涂黑。", "Paint the squares black to copy the target picture.", "Peignez les carrés en noir pour copier l'image cible."))
act(W, 12, T("读出图片的数字", "Reading the numbers of a picture", "Lire les nombres d'une image"), "pixels", "pixel", {"mode": "nums", "pic": "arrow"}, T("黑是 1，白是 0。把每一行写成二进制数，再换成十进制，填进框里。", "Black is 1, white is 0. Read each row as a binary number, convert it to decimal and type it in the box.", "Noir = 1, blanc = 0. Lisez chaque ligne comme un nombre binaire, convertissez-le en décimal et saisissez-le."))
act(W, 13, T("用数字画图", "Drawing from numbers", "Dessiner avec des nombres"), "pixels", "pixel", {"mode": "decode", "pic": "house"}, T("每个数字是一行的二进制数。把图画出来。", "Each number is the binary value of one row. Draw the picture.", "Chaque nombre est la valeur binaire d'une ligne. Dessinez l'image."))
act(W, 14, T("自由创作 16 × 16", "Free picture 16 × 16", "Image libre 16 × 16"), "imgsize", "pixel", {"mode": "free", "size": 16}, T("画一幅 16 × 16 的黑白图，再算出它需要多少字节。", "Draw a 16 × 16 black-and-white picture, then work out how many bytes it needs.", "Dessinez une image noir et blanc de 16 × 16, puis calculez combien d'octets elle demande."))
act(W, 15, T("RGB 颜色", "RGB colours", "Couleurs RVB"), "rgb", "quiz", {"gen": "colorName", "n": 4})
act(W, 16, T("调出颜色", "Mixing colours", "Mélanger les couleurs"), "rgb", "rgbmix", {"targets": [[255, 128, 0], [0, 200, 100], [120, 60, 200]], "tol": 40}, T("调节 R、G、B，让右边的颜色接近左边的目标颜色。", "Adjust R, G and B until the right colour is close to the target on the left.", "Réglez R, V et B pour que la couleur de droite soit proche de la cible à gauche."))
act(W, 17, T("图片有多大", "How big is a picture", "Quelle taille pour une image"), "imgsize", "quiz", {"gen": "imgSize", "n": 3})
act(W, 18, T("声音的采样", "Sampling sound", "Échantillonner le son"), "sampling", "wave", {"freq": 440, "rates": [600, 800, 1000, 2000, 4000, 8000, 44100]}, T("把 440 Hz 的声音数字化。找出仍能还原音高的最小采样率。", "Digitise a 440 Hz tone. Find the lowest sample rate that still keeps the pitch.", "Numérisez un son de 440 Hz. Trouvez la fréquence d'échantillonnage la plus basse qui garde la hauteur."))
act(W, 19, T("游程编码", "Run-length coding", "Codage par plages"), "rle", "quiz", {"gen": "rleEnc", "n": 3})
act(W, 20, T("还原与比较", "Decoding and comparing", "Décoder et comparer"), "rle", "quiz", {"gen": ["rleDec", "rleSize"], "n": 4})
act(W, 21, T("哈夫曼树", "A Huffman tree", "Un arbre de Huffman"), "huffman", "huff", {"text": "ABRACADABRA"}, T("每次合并权重最小的两个节点，直到只剩一棵树。", "Merge the two nodes of smallest weight each time until one tree is left.", "Fusionnez à chaque fois les deux nœuds de plus petit poids jusqu'à obtenir un seul arbre."))
act(W, 22, T("无损还是有损", "Lossless or lossy", "Avec ou sans perte"), "lossy", "scenario", {"qs": [
  {"p": "一份电子合同需要压缩后发给别人，打开后一个字都不能错。应该用哪种压缩？", "o": ["无损压缩", "有损压缩"], "a": 0, "w": "合同的每个字符都重要，必须能完全还原，所以用无损压缩（如 ZIP）。"},
  {"p": "一张风景照片要发到网上，希望文件尽量小，看起来差不多就行。适合用哪种压缩？", "o": ["无损压缩", "有损压缩"], "a": 1, "w": "照片可以丢掉人眼不容易察觉的细节，JPEG 这样的有损压缩能让文件小很多。"},
  {"p": "一个程序文件压缩后解压，却少了几个字节。会发生什么？", "o": ["没关系，程序照样能运行", "程序可能出错或无法运行"], "a": 1, "w": "程序是精确的指令，少一个字节就可能改变含义，所以程序必须无损压缩。"},
  {"p": "下面哪个说法是对的？", "o": ["有损压缩后的文件可以还原成原来的样子", "有损压缩去掉了一部分信息，不能完全还原"], "a": 1, "w": "有损压缩是用损失一部分信息来换取更小的文件，丢掉的信息找不回来。"}]},
  T("选择合适的压缩方式。", "Choose the right kind of compression.", "Choisissez le bon type de compression."))
act(W, 23, T("凯撒密码", "Caesar cipher", "Chiffre de César"), "caesar", "quiz", {"gen": "caesarDec", "n": 3, "wheel": True})
act(W, 24, T("破解凯撒密码", "Breaking a Caesar cipher", "Casser un chiffre de César"), "caesar", "quiz", {"gen": "caesarBreak", "n": 3, "wheel": True})
act(W, 25, T("频率分析", "Frequency analysis", "Analyse de fréquence"), "subst", "subst", {"text": "THE BEST WAY TO LEARN IS TO TRY AND THEN TRY AGAIN", "seed": 4, "given": "T"}, T("这是一段替换密码。根据字母出现的次数，把密文解出来。", "This is a substitution cipher. Use the letter counts to decode it.", "Voici un chiffre par substitution. Utilisez le nombre d'occurrences des lettres pour le décoder."))
act(W, 26, T("异或", "XOR", "OU exclusif"), "xor", "quiz", {"gen": ["xor", "xorBack"], "n": 4})
act(W, 27, T("奇偶校验", "Parity bits", "Bits de parité"), "parity", "quiz", {"gen": ["parity", "parityCheck"], "n": 4})
act(W, 28, T("找出错误的一位", "Find the flipped bit", "Trouver le bit inversé"), "ecc", "fixbit", {"mode": "2d", "rounds": 3, "assist": True}, T("数据在传输中有一位出错了。行和列的校验会报错，点击出错的那一位。", "One bit flipped in transit. The row and column checks show it: tap the wrong bit.", "Un bit a été inversé pendant la transmission. Les contrôles de ligne et de colonne le montrent : touchez le bit erroné."))
act(W, 29, T("海明码", "Hamming code", "Code de Hamming"), "ecc", "fixbit", {"mode": "ham", "rounds": 3, "assist": True}, T("海明码 (7,4)：位置 1、2、4 是校验位。三个检查合起来指出出错的位置。点击出错的那一位。", "Hamming (7,4): positions 1, 2 and 4 are check bits. The three checks together give the wrong position. Tap it.", "Hamming (7,4) : les positions 1, 2 et 4 sont des bits de contrôle. Les trois contrôles donnent la position erronée. Touchez-la."))
act(W, 30, T("校验码", "Check digits", "Chiffres de contrôle"), "checkdigit", "quiz", {"gen": ["isbn", "idcard"], "n": 4})
act(W, 31, T("排序与筛选", "Sorting and filtering", "Trier et filtrer"), "table", "table", {"cols": ["姓名", "语文", "数学"], "rows": [["小明", 88, 95], ["小红", 92, 78], ["小华", 75, 90], ["小丽", 96, 85], ["小强", 81, 60], ["小芳", 90, 99]], "tasks": [
  {"type": "sort", "col": 2, "dir": "desc", "p": "按“数学”从高到低排序（点击表头）。"},
  {"type": "filter", "col": 1, "op": ">=", "v": 90, "p": "只显示“语文”不低于 90 的同学（选择列和条件，输入 90）。"},
  {"type": "ask", "p": "数学成绩最高的同学是谁？", "a": "小芳"}]}, T("用排序和筛选回答问题。", "Answer the questions with sorting and filtering.", "Répondez avec le tri et le filtre."))
act(W, 32, T("平均数、中位数、众数", "Mean, median and mode", "Moyenne, médiane et mode"), "stats", "quiz", {"gen": ["mean", "median", "mode"], "n": 4})
act(W, 33, T("读图表", "Reading charts", "Lire des graphiques"), "charts", "quiz", {"gen": ["barRead", "barMax", "barDiff"], "n": 4})
act(W, 34, T("电子表格：求和与平均", "Spreadsheet: sum and average", "Tableur : somme et moyenne"), "sheet", "sheet", {"rows": 6, "cells": {"A1": "水果", "B1": "数量", "C1": "单价", "A2": "苹果", "B2": "5", "C2": "2", "A3": "梨", "B3": "8", "C3": "3", "A4": "香蕉", "B4": "3", "C4": "4", "A5": "橙子", "B5": "6", "C5": "5", "A6": "合计"}, "tasks": [
  {"cell": "B6", "fn": "SUM", "range": "B2:B5", "p": "在 B6 输入公式，求数量的合计。"},
  {"cell": "C6", "fn": "AVERAGE", "range": "C2:C5", "p": "在 C6 输入公式，求平均单价。"},
  {"cell": "D6", "fn": "MAX", "range": "B2:B5", "p": "在 D6 输入公式，求最大的数量。"}]}, T("在表格里输入公式（以 = 开头）。", "Type formulas into the sheet (starting with =).", "Saisissez des formules dans le tableur (commençant par =)."))
act(W, 35, T("电子表格：用公式计算", "Spreadsheet: formulas", "Tableur : formules"), "sheet", "sheet", {"rows": 6, "cells": {"A1": "水果", "B1": "数量", "C1": "单价", "D1": "金额", "A2": "苹果", "B2": "5", "C2": "2", "A3": "梨", "B3": "8", "C3": "3", "D3": "=B3*C3", "A4": "香蕉", "B4": "3", "C4": "4", "D4": "=B4*C4", "A5": "橙子", "B5": "6", "C5": "5", "A6": "合计"}, "tasks": [
  {"cell": "D2", "expr": "B2*C2", "p": "在 D2 输入公式：数量 × 单价。"},
  {"cell": "D5", "expr": "B5*C5", "p": "在 D5 输入公式：数量 × 单价。"},
  {"cell": "D6", "fn": "SUM", "range": "D2:D5", "p": "在 D6 输入公式，求金额的合计。"}]}, T("用公式算出每一行的金额和总金额。", "Use formulas to get each amount and the total.", "Utilisez des formules pour obtenir chaque montant et le total."), boss=True)

# ======================= activities: world 15 =======================
W = 15
net1 = {"nodes": [{"id": "C", "x": 30, "y": 95, "label": "PC"}, {"id": "R1", "x": 100, "y": 40}, {"id": "R2", "x": 100, "y": 150}, {"id": "R3", "x": 190, "y": 40}, {"id": "R4", "x": 190, "y": 150}, {"id": "S", "x": 270, "y": 95, "label": "S"}],
        "edges": [["C", "R1"], ["C", "R2"], ["R1", "R3"], ["R2", "R4"], ["R3", "S"], ["R4", "S"], ["R1", "R2"]]}
net2 = {"nodes": [{"id": "C", "x": 28, "y": 95, "label": "PC"}, {"id": "A", "x": 82, "y": 38}, {"id": "B", "x": 82, "y": 152}, {"id": "D", "x": 170, "y": 70}, {"id": "E", "x": 150, "y": 160}, {"id": "F", "x": 232, "y": 150}, {"id": "S", "x": 272, "y": 70, "label": "S"}],
        "edges": [["C", "A"], ["C", "B"], ["A", "D"], ["B", "D"], ["B", "E"], ["D", "F"], ["E", "F"], ["F", "S"], ["D", "S"]]}
act(W, 1, T("数据包旅行", "A packet journey", "Le voyage d'un paquet"), "packets", "route", {"net": net1, "from": "C", "to": "S", "ttl": 4, "msg": "HELLO WORLD", "size": 4, "blocked": {"1": ["R1", "R3"]}}, T("把信息切成数据包。点击相邻的路由器，把每个数据包送到服务器 S（TTL 是最多能走的步数）。", "The message is cut into packets. Tap neighbouring routers to send each packet to the server S (TTL is the maximum number of hops).", "Le message est découpé en paquets. Touchez les routeurs voisins pour envoyer chaque paquet au serveur S (le TTL est le nombre maximal de sauts)."))
act(W, 2, T("绕开堵塞", "Around the traffic jam", "Contourner l'embouteillage"), "packets", "route", {"net": net2, "from": "C", "to": "S", "ttl": 4, "msg": "NETWORK", "size": 3, "blocked": {"1": ["B", "D"], "2": ["D", "S"]}}, T("有些线路堵住了（红色虚线）。每个数据包要在 TTL 内找到一条通路。", "Some links are jammed (red dashes). Each packet must find a path within the TTL.", "Certaines liaisons sont saturées (tirets rouges). Chaque paquet doit trouver un chemin dans la limite du TTL."))
act(W, 3, T("输入网址之后", "After typing a web address", "Après avoir tapé une adresse"), "web", "order", {"items": ["浏览器检查输入的网址", "向 DNS 服务器询问这个域名对应的 IP 地址", "DNS 服务器返回 IP 地址", "浏览器与服务器建立连接", "浏览器向服务器发送 HTTP 请求", "服务器返回网页内容", "浏览器把网页显示出来"]}, T("把打开一个网页的步骤按先后顺序排好。", "Put the steps of opening a web page in order.", "Mettez dans l'ordre les étapes d'ouverture d'une page web."))
act(W, 4, T("三次握手", "The three-way handshake", "La poignée de main en trois temps"), "proto", "order", {"items": ["客户端：我想连接（SYN）", "服务器：收到，我也准备好了（SYN + ACK）", "客户端：收到（ACK）", "双方开始传输数据", "传完后双方请求关闭连接"]}, T("把 TCP 建立连接的过程排好顺序。", "Put the setting-up of a TCP connection in order.", "Mettez dans l'ordre l'établissement d'une connexion TCP."))
act(W, 5, T("HTTP 对话", "An HTTP conversation", "Une conversation HTTP"), "proto", "order", {"items": ["浏览器：GET /index.html（请求网页）", "服务器：200 OK + 网页内容", "浏览器：GET /logo.png（请求网页里的图片）", "服务器：200 OK + 图片"]}, T("把浏览器和服务器的对话排好顺序。", "Put the conversation between browser and server in order.", "Mettez dans l'ordre la conversation entre le navigateur et le serveur."))
act(W, 6, T("IP 地址", "IP addresses", "Adresses IP"), "ip", "quiz", {"gen": "ip", "n": 4})
act(W, 7, T("域名和电话簿", "Domain names and the phone book", "Noms de domaine et annuaire"), "web", "scenario", {"qs": [
  {"p": "DNS 的作用是什么？", "o": ["把域名翻译成 IP 地址", "加快网络速度", "清除病毒", "保存网页"], "a": 0, "w": "DNS 像电话簿：人记名字（www.example.com），电脑用数字地址（IP 地址）通信，DNS 负责翻译。"},
  {"p": "如果没有 DNS，我们上网要怎样？", "o": ["要记住每个网站的 IP 地址", "什么也不影响", "只能用手机上网", "网站会自动变快"], "a": 0, "w": "没有 DNS 就要直接输入数字地址，很不方便，所以 DNS 是互联网的基础服务。"},
  {"p": "一个网址 www.example.com 的“.com”部分叫什么？", "o": ["顶级域名", "端口", "密码", "文件名"], "a": 0, "w": "域名从右到左分级：.com 是顶级域名，example 是二级域名，www 常用来表示网站服务。"}]}, T("回答关于 DNS 的问题。", "Answer the questions about DNS.", "Répondez aux questions sur le DNS."))
act(W, 8, T("设置强密码", "Make a strong password", "Créer un mot de passe fort"), "password", "password", {"tasks": [{"level": 2, "p": "第 1 关：设置一个“中等”强度的密码。", "forbid": []}, {"level": 4, "p": "第 2 关：设置一个“很强”的密码，并且不能包含 xiaoming、2012 或 123。", "forbid": ["xiaoming", "2012", "123"]}]}, T("输入密码，观察强度条和破解时间。", "Type a password and watch the strength bar and the time to crack.", "Saisissez un mot de passe et observez la barre de force et le temps de cassage."))
act(W, 9, T("密码强度的计算", "Computing password strength", "Calculer la force d'un mot de passe"), "password", "quiz", {"gen": "entropy", "n": 3})
act(W, 10, T("两步验证与保密", "Two-step verification and secrecy", "Double authentification et secret"), "twostep", "scenario", {"qs": [
  {"p": "你收到短信验证码，一个自称“客服”的人打电话要你读出来。你应该怎么办？", "o": ["读给他，他是客服", "不告诉任何人，挂断电话，通过官方渠道核实", "只告诉前两位数字"], "a": 1, "w": "验证码就是登录的钥匙。真正的客服不会向你索要验证码，遇到这种电话要马上挂断。"},
  {"p": "两步验证最主要的好处是什么？", "o": ["密码泄露后，坏人仍然不容易登录", "让登录更快", "不用再设置密码"], "a": 0, "w": "第二步（验证码、指纹）是坏人拿不到的东西，所以光有密码还不够登录。"},
  {"p": "好朋友说：“把你的游戏密码告诉我，我帮你升级。”最好的做法是？", "o": ["告诉他，朋友值得信任", "不给密码，可以一起玩，由自己操作", "把密码发到群里"], "a": 1, "w": "密码只属于自己。好朋友之间也不要交换密码，一起玩时由自己登录就好。"},
  {"p": "下面哪个做法最安全？", "o": ["所有网站用同一个密码", "每个重要账号用不同的密码", "把密码写在书包外面"], "a": 1, "w": "如果一个网站泄露了密码，同一个密码在别处也会被试。每个账号用不同密码能把损失限制在一处。"}]}, T("回答问题，选出最安全的做法。", "Answer the questions and choose the safest action.", "Répondez et choisissez la conduite la plus sûre."))
act(W, 11, T("真假信息", "Real or fake messages", "Messages vrais ou faux"), "phishing", "sort", {"buckets": [T("可信", "Trustworthy", "Fiable"), T("可疑（钓鱼 / 诈骗）", "Suspicious (phishing / scam)", "Suspect (hameçonnage / arnaque)")], "cards": [
  {"t": "老师在班级群里发的通知：明天带美术课用品。", "b": 0}, {"t": "“您的账户存在风险，请立即点击链接并输入密码，否则 1 小时后冻结！”", "b": 1},
  {"t": "“恭喜你中了一台手机！只需交 50 元运费并告诉我们验证码。”", "b": 1}, {"t": "学校官方应用推送：本周五下午放学时间调整。", "b": 0},
  {"t": "“我是你的同学，手机坏了，借我 200 元，转到这个新账号。”（陌生号码）", "b": 1}, {"t": "快递员电话：您的包裹已到小区门口，请下楼取件。（你正在等快递）", "b": 0}]}, T("把信息分成“可信”和“可疑”两类。", "Sort the messages into trustworthy and suspicious.", "Classez les messages en fiables et suspects."))
act(W, 12, T("看清网址", "Reading the address", "Lire l'adresse"), "phishing", "sort", {"buckets": [T("正常网址", "Normal address", "Adresse normale"), T("可疑网址", "Suspicious address", "Adresse suspecte")], "cards": [
  {"t": "https://www.example.com/login", "b": 0}, {"t": "http://examp1e-login.com.verify-user.cn", "b": 1}, {"t": "https://www.example.com.fake-pay.top", "b": 1},
  {"t": "https://map.example.com/search", "b": 0}, {"t": "http://192.168.0.77/bank/login", "b": 1}, {"t": "https://mail.example.com/inbox", "b": 0}]}, T("域名要从右往左看，主要部分在最后一个点之前。把网址分类。", "Read a domain from right to left; the main part stands before the last dot. Sort the addresses.", "Lisez un domaine de droite à gauche ; la partie principale précède le dernier point. Classez les adresses."))
act(W, 13, T("个人信息", "Personal data", "Données personnelles"), "privacy", "sort", {"buckets": [T("个人信息（不要随便给）", "Personal data (do not share freely)", "Données personnelles (à ne pas partager)"), T("一般信息（可以说）", "General information (fine to share)", "Informations générales (peuvent être partagées)")], "cards": [
  {"t": "家庭住址", "b": 0}, {"t": "我喜欢画画", "b": 1}, {"t": "身份证号码", "b": 0}, {"t": "今天的天气很好", "b": 1}, {"t": "手机号码", "b": 0}, {"t": "学校和班级", "b": 0}, {"t": "最喜欢的颜色", "b": 1}, {"t": "账号密码", "b": 0}]}, T("把信息分成“个人信息”和“一般信息”两类。", "Sort the items into personal data and general information.", "Classez les éléments en données personnelles et informations générales."))
act(W, 14, T("应用权限", "App permissions", "Autorisations des applications"), "privacy", "scenario", {"qs": [
  {"p": "一个手电筒应用要求读取你的通讯录和位置。你应该？", "o": ["允许，它需要", "拒绝，手电筒不需要这些", "允许，但是不告诉家长"], "a": 1, "w": "手电筒只需要控制闪光灯。要求不相干的权限很可疑，只给必要的权限。"},
  {"p": "地图应用要求使用你的位置才能导航。合理吗？", "o": ["合理，导航需要位置", "不合理，一定要拒绝"], "a": 0, "w": "导航需要知道你在哪里。可以选择“使用期间允许”，不用时不会一直定位。"},
  {"p": "一个拼图游戏要求打开麦克风。你应该？", "o": ["允许", "拒绝，拼图游戏不需要麦克风"], "a": 1, "w": "游戏的功能和麦克风无关。拒绝不相干的权限不影响正常玩。"},
  {"p": "陌生人在游戏里问：“你住在哪个小区？读几年级？”你应该？", "o": ["告诉他，反正是游戏", "不回答，告诉家长或举报"], "a": 1, "w": "地址和学校是个人信息，告诉陌生人可能带来危险。不回答，并告诉家长。"}]}, T("判断应用和陌生人的要求是否合理。", "Judge whether the requests of apps and strangers are reasonable.", "Jugez si les demandes des applications et des inconnus sont raisonnables."))
act(W, 15, T("网络礼仪与版权", "Etiquette and copyright", "Savoir-vivre et droit d'auteur"), "etiquette", "scenario", {"qs": [
  {"p": "同学在群里发了一张班里另一位同学出丑的照片。你应该？", "o": ["转发，大家一起笑", "不转发，告诉他删除，必要时告诉老师", "评论嘲笑"], "a": 1, "w": "未经同意传播别人的照片会伤害别人，也可能侵犯隐私。不转发、劝说删除是负责任的做法。"},
  {"p": "写作业时，你想用网上一篇文章的几句话。正确的做法是？", "o": ["整篇复制，署上自己的名字", "引用并写明出处", "改几个字就算自己的"], "a": 1, "w": "引用别人的内容要注明作者和出处。把别人的作品当作自己的是抄袭。"},
  {"p": "在网上看到一条没有来源的“重要消息”，让大家转发。你应该？", "o": ["马上转发", "先核实来源，不确定就不转发"], "a": 1, "w": "谣言传得快、害处大。转发前先想：来源可靠吗？别人证实了吗？"},
  {"p": "你想用一首流行歌曲当视频的背景音乐并发到网上。应该注意什么？", "o": ["音乐有版权，要用有授权的音乐", "网上的音乐都可以随便用"], "a": 0, "w": "歌曲有版权。可以使用平台提供的授权音乐，或标明“可自由使用”的作品。"}]}, T("判断哪种做法有礼貌、尊重版权。", "Judge which action is polite and respects copyright.", "Jugez quelle conduite est polie et respecte le droit d'auteur."))
act(W, 16, T("小小杀毒软件", "A tiny antivirus", "Un petit antivirus"), "antivirus", "pick", {"scan": True, "items": [
  {"t": "作业.docx", "bad": False, "risk": 0, "why": "这是正常的文档。"}, {"t": "photo.jpg.exe", "bad": True, "risk": 3, "why": "真正的类型是 .exe（程序），假装成图片。"},
  {"t": "游戏破解补丁.exe", "bad": True, "risk": 3, "why": "来历不明的破解程序经常带病毒。"}, {"t": "照片.png", "bad": False, "risk": 0, "why": "这是正常的图片。"},
  {"t": "快递单.pdf.scr", "bad": True, "risk": 2, "why": ".scr 是可执行的屏保程序，不是 PDF。"}, {"t": "音乐.mp3", "bad": False, "risk": 1, "why": "这是正常的音乐文件，风险标记较低。"}, {"t": "学习资料.zip（来自陌生邮件）", "bad": True, "risk": 2, "why": "陌生邮件的压缩包可能藏有病毒。"}]}, T("先扫描。把有风险的文件放进隔离区（选中），正常的文件不要选。", "Scan first. Quarantine the risky files (select them) and leave the normal ones.", "Lancez d'abord l'analyse. Mettez en quarantaine les fichiers risqués (sélectionnez-les), laissez les fichiers normaux."), boss=False)
KNN = {"names": [T("蓝色类", "Blue class", "Classe bleue"), T("橙色类", "Orange class", "Classe orange")], "per": 25, "spread": 1.4, "flip": 0.0}
act(W, 17, T("机器怎样判断", "How the machine decides", "Comment la machine décide"), "knn", "knn", {**KNN, "task": "find", "goals": 4}, T("在图上点击一个位置，让机器把它判断为", "Tap a place on the plane so that the machine decides it belongs to:", "Touchez un endroit du plan pour que la machine le range dans :"))
act(W, 18, T("训练与测试", "Training and testing", "Entraînement et test"), "overfit", "knn", {**KNN, "task": "k", "per": 30, "spread": 1.7, "flip": 0.12, "tasks": [{"goal": "train", "p": "第 1 步：选一个 k，让训练准确率达到 100%。"}, {"goal": "test", "p": "第 2 步：现在看用没见过的测试数据：选出测试准确率最高的 k。"}]}, T("调整 k，比较训练准确率和测试准确率。", "Change k and compare the training accuracy with the test accuracy.", "Changez k et comparez la précision d'entraînement et la précision de test."))
act(W, 19, T("猜动物的决策树", "A decision tree for animals", "Un arbre de décision pour les animaux"), "tree", "tree", {"feats": [T("有四条腿", "Has four legs", "A quatre pattes"), T("会飞", "Can fly", "Vole"), T("会游泳", "Swims", "Nage"), T("有毛", "Has fur", "A des poils"), T("会下蛋", "Lays eggs", "Pond des œufs"), T("体型大", "Is big", "Est grand"), T("有眼睛", "Has eyes", "A des yeux")], "classes": [T("哺乳动物", "Mammal", "Mammifère"), T("鸟", "Bird", "Oiseau"), T("鱼", "Fish", "Poisson"), T("爬行 / 两栖", "Reptile / amphibian", "Reptile / amphibien")]}, T("点问题，把动物逐步分类，直到每个分支只剩一种。问题越少越好。", "Tap questions to split the animals until each branch holds one kind. Fewer questions are better.", "Touchez des questions pour répartir les animaux jusqu'à ce que chaque branche n'ait qu'un type. Moins de questions, c'est mieux."))
act(W, 20, T("规则够用吗", "Are rules enough", "Les règles suffisent-elles"), "rules", "rules", {"data": "easy", "names": [T("蓝", "Blue", "Bleu"), T("橙", "Orange", "Orange")]}, T("拖动滑块，写一条规则，让准确率不低于 90%。", "Move the sliders to write a rule with at least 90 % accuracy.", "Déplacez les curseurs pour écrire une règle avec au moins 90 % de précision."))
act(W, 21, T("规则还是学习", "Rule or learning", "Règle ou apprentissage"), "rules", "rules", {"data": "diag", "names": [T("蓝", "Blue", "Bleu"), T("橙", "Orange", "Orange")]}, T("这次界线是斜的。先试着写规则，再让机器学习，最后判断哪种方法更准确。", "This time the border is slanted. Try a rule, then let the machine learn, then decide which is more accurate.", "Cette fois la frontière est oblique. Essayez une règle, laissez la machine apprendre, puis dites laquelle est la plus précise."))
DOCS = ["猫 喜欢 吃 鱼", "狗 喜欢 吃 肉", "猫 喜欢 玩 球", "鱼 生活 在 水 里", "狗 喜欢 玩 球", "猫 生活 在 家 里"]
act(W, 22, T("建立索引", "Building an index", "Construire un index"), "search", "search", {"docs": DOCS, "queries": [["猫"], ["鱼"], ["球"]]}, T("找出含有这个词的所有网页（点选）。", "Select all the pages that contain the word.", "Sélectionnez toutes les pages qui contiennent le mot."))
act(W, 23, T("搜索多个词", "Searching several words", "Rechercher plusieurs mots"), "search", "search", {"docs": DOCS, "queries": [["猫", "喜欢"], ["喜欢", "球"], ["生活", "里"], ["猫", "鱼"]]}, T("搜索多个词：只有同时含有全部词语的网页才是答案。", "With several words, only the pages that contain all of them are results.", "Avec plusieurs mots, seules les pages qui les contiennent tous sont des résultats."), boss=False)
act(W, 24, T("数据里的偏见", "Bias in data", "Biais dans les données"), "bias", "bias", {"seed": 3}, T("历史数据对 B 组更严格。选择机器可以使用的信息，训练模型：让两组之间的差距不超过 20%，同时准确率不低于 85%。", "The history was stricter with group B. Choose what the machine may use and train it: a gap of at most 20 % between the groups with at least 85 % accuracy.", "L'historique était plus strict avec le groupe B. Choisissez ce que la machine peut utiliser et entraînez-la : un écart d'au plus 20 % entre les groupes et au moins 85 % de précision."))
act(W, 25, T("认数字的机器", "A machine that reads digits", "Une machine qui lit les chiffres"), "digit", "digit", {"mode": "draw", "targets": [3, 7, 1]}, T("在 8 × 8 的格子里画出数字，让机器认出来，画：", "Draw the digit on the 8 × 8 grid and let the machine recognise it. Draw:", "Dessinez le chiffre sur la grille 8 × 8 et laissez la machine le reconnaître. Dessinez :"))
act(W, 26, T("机器没有把握", "When the machine is unsure", "Quand la machine hésite"), "digit", "digit", {"mode": "unsure"}, T("画一个让机器没有把握的图形（置信度低于 40%）。", "Draw something the machine is unsure about (confidence below 40 %).", "Dessinez quelque chose dont la machine n'est pas sûre (confiance inférieure à 40 %)."))
act(W, 27, T("生成式人工智能", "Generative AI", "IA générative"), "genai", "scenario", {"qs": [
  {"p": "聊天机器人是怎样写出一段话的？", "o": ["它像人一样理解并思考", "它根据大量文字，预测接下来最可能出现的内容", "它在互联网上找到现成的答案复制"], "a": 1, "w": "生成式模型是用大量文字训练的，每次预测“下一个最可能的词”。它写得流畅，但并不等于真的理解。"},
  {"p": "机器人回答得很自信，但你怀疑有错。应该怎么做？", "o": ["相信，它很自信", "用书本或可靠网站核对重要内容", "再问它一次，它说是对的就行"], "a": 1, "w": "自信不等于正确。生成式人工智能可能编出不存在的事实（“幻觉”），重要信息必须核实。"},
  {"p": "老师让你写一篇关于自己的作文。你用机器人生成，然后交上去。这样做？", "o": ["可以，反正是好文章", "不合适：作文是要练习自己的表达，使用时要如实说明", "没问题，别人看不出来"], "a": 1, "w": "作业的目的是练习。可以把机器人当作帮助理解的工具，但不能代替自己思考，使用了要如实说明。"}]}, T("回答关于生成式人工智能的问题。", "Answer the questions about generative AI.", "Répondez aux questions sur l'IA générative."))
act(W, 28, T("人工智能的限制与责任", "Limits and responsibility of AI", "Limites et responsabilité de l'IA"), "genai", "scenario", {"qs": [
  {"p": "一个识别人脸的系统，对某一类人的错误率高很多。可能的原因是？", "o": ["机器故意的", "训练数据里这类人的照片太少", "摄像头坏了"], "a": 1, "w": "机器从数据里学习。数据里缺少某一类人，它就学得不好，所以数据要全面、要检查是否公平。"},
  {"p": "语音助手没有听懂你的话。最合理的解释是？", "o": ["它还不够了解这种口音、噪音或说法", "它不喜欢你"], "a": 0, "w": "语音识别是根据声音的模式猜测文字，口音、噪音、说话太快都会影响。它会出错。"},
  {"p": "医院用人工智能辅助看片子。最合适的使用方式是？", "o": ["完全由机器决定，医生不用看", "机器提出建议，由医生最后判断并负责", "机器的结果不用告诉病人"], "a": 1, "w": "涉及健康、安全的重要决定要由人负责。人工智能可以提供帮助，但不能取代人的判断和责任。"},
  {"p": "你用 AI 绘图工具生成了一幅画并想发表。应该？", "o": ["假装是手绘的", "说明是用 AI 生成的，并注意不侵犯别人的权利", "不用说明"], "a": 1, "w": "诚实地说明作品的来源。还要注意不用它去模仿、伪造他人，不生成伤害别人的内容。"}]}, T("判断人工智能的使用是否恰当。", "Judge whether a use of AI is appropriate.", "Jugez si un usage de l'IA est approprié."))

# ======================= world 16: devices =======================
W = 16
D = [
 ("i16-01", T("智能路灯：第一步", "A street lamp", "Un lampadaire"), T("天黑（光线低于 30）时点亮路灯，否则熄灭。传感器 light，执行器 lamp（1 = 亮）。", "Turn the lamp on when it is dark (light below 30), otherwise off. Sensor light, actuator lamp (1 = on).", "Allumez le lampadaire quand il fait sombre (light inférieur à 30), sinon éteignez-le. Capteur light, actionneur lamp (1 = allumé)."), "scan",
   ["“如果 light < 30 就让 lamp = 1，否则 lamp = 0。”用“如果…否则”积木。", "写好后点“全部检查”，看哪个场景没有通过，再对照提示修改。"], ["天黑时灯没有亮。", "天亮时灯还亮着。"], ["黄昏", "黎明", "多云"]),
 ("i16-02", T("红绿灯", "A traffic light", "Un feu tricolore"), T("让红绿灯循环：绿灯 4 轮，黄灯 1 轮，红灯 4 轮，每次只亮一盏。用变量 timer 计时。", "Cycle the lights: green for 4 ticks, yellow for 1, red for 4, only one lamp on at a time. Use the variable timer.", "Faites cycler les feux : vert 4 tours, orange 1, rouge 4, une seule lampe à la fois. Utilisez la variable timer."), "timing",
   ["每一轮先让 timer 加 1。", "timer ≤ 4 绿灯；timer = 5 黄灯；其余红灯；timer ≥ 9 时归零。"], ["没有任何灯亮。", "同时亮了不止一盏灯。", "灯的顺序或时间不对。"], ["循环", "长时间"]),
 ("i16-03", T("路灯：留点余地", "Street lamp with hysteresis", "Lampadaire avec hystérésis"), T("光线在 30 到 50 之间晃动时灯不能闪。低于 30 开灯，高于 50 关灯，中间保持原来的状态。", "The lamp must not flicker when light wobbles between 30 and 50. On below 30, off above 50, unchanged in between.", "Le lampadaire ne doit pas clignoter quand light oscille entre 30 et 50. Allumé sous 30, éteint au-dessus de 50, inchangé entre les deux."), "hyst",
   ["执行器的值会保留到下一轮：不需要“否则”。", "两条独立的规则：light < 30 → lamp = 1；light > 50 → lamp = 0。"], ["光线低于 30，灯没有亮。", "光线高于 50，灯没有关。", "光线在 30 到 50 之间，灯的状态不该改变。"], ["日落", "日出", "晃动 1", "晃动 2", "随机 1", "随机 2", "随机 3", "渐变", "边界", "来回"]),
 ("i16-04", T("自动门", "An automatic door", "Une porte automatique"), T("有人走近（dist 小于 100）就开门。人走开后再等 3 轮才关门，避免夹到人。用变量 wait 计数。", "Open the door when somebody is near (dist below 100). After they leave, wait 3 ticks before closing. Count with the variable wait.", "Ouvrez la porte quand quelqu'un est proche (dist inférieur à 100). Après son départ, attendez 3 tours avant de fermer. Comptez avec la variable wait."), "delay",
   ["有人：door = 1 并且 wait = 0。", "没人：如果门开着，wait 加 1；wait ≥ 3 时关门。"], ["有人在门前，门没有打开。", "人刚走开，门关得太早（要等 3 轮）。"], ["走过", "停顿", "两次", "站着", "徘徊"]),
 ("i16-05", T("恒温器", "A thermostat", "Un thermostat"), T("房间要保持在 20 度左右。加热器开时升温，关时降温。低于 18 度开，达到 22 度关。开关不能太频繁。", "Keep the room near 20 degrees. The heater warms the room when on and the room cools when off. On below 18, off at 22. Do not switch too often.", "Gardez la pièce autour de 20 degrés. Le chauffage réchauffe quand il est allumé. Allumé sous 18, éteint à 22. Ne commutez pas trop souvent."), "hyst",
   ["用两个门槛：temp < 18 → heater = 1；temp ≥ 22 → heater = 0。", "不要用“否则”：中间区域保持原样。"], ["温度太低（低于 15 度）。", "温度太高（高于 25 度）。", "加热器开关太频繁。"], ["很冷", "较冷", "较暖", "有风", "刚好"]),
 ("i16-06", T("自动浇花", "Automatic watering", "Arrosage automatique"), T("土壤湿度 soil 低于 30 时开水泵，达到 60 时关。水箱 tank 空了必须关泵（泵空转会坏）。", "Start the pump when soil moisture is below 30 and stop at 60. When the tank is empty the pump must be off (running dry breaks it).", "Démarrez la pompe quand l'humidité du sol est inférieure à 30 et arrêtez-la à 60. Quand le réservoir est vide, la pompe doit être arrêtée."), "guard",
   ["先写土壤的两条规则，再加一条保护规则。", "tank ≤ 0 时 pump 必须是 0，要放在最后。"], ["水箱已经空了，水泵还开着。", "浇水太多，土壤过湿。", "土壤太干，没有及时浇水。"], ["半满", "很干", "水箱快空", "很湿"]),
 ("i16-07", T("报警器", "An alarm", "Une alarme"), T("有烟，或者（有人移动并且门开着）时报警。把 8 种输入组合都做对。", "Sound the alarm when there is smoke, or (motion and the door is open). Get all 8 input combinations right.", "Déclenchez l'alarme en cas de fumée, ou (mouvement et porte ouverte). Réussissez les 8 combinaisons d'entrées."), "logic",
   ["“并且”可以写成两个值相加等于 2：motion + door == 2。", "先让 alarm = 0，再用两条规则把它变成 1。"], ["应该报警，但没有报警。", "不该报警，却报警了。"], ["000", "001", "010", "011", "100", "101", "110", "111"]),
 ("i16-08", T("流水线计数", "A conveyor counter", "Compteur de convoyeur"), T("每个盒子经过传感器时 box 会连续两轮为 1，只能数一次。数满 5 个盒子，pack 在那一轮为 1，然后重新计数。", "A box keeps box at 1 for two ticks but counts once. After 5 boxes, pack is 1 for that tick and the counter restarts.", "Un carton laisse box à 1 pendant deux tours mais ne compte qu'une fois. Après 5 cartons, pack vaut 1 pendant ce tour et le compteur repart."), "edge",
   ["用变量 seen 记住上一轮是否已看见盒子。", "box = 1 且 seen = 0：count 加 1，seen = 1；box = 0：seen = 0。"], ["第 5 个盒子到达时，pack 应该为 1。", "pack 不该为 1 的时候是 1。"], ["12 个盒子", "5 个盒子", "4 个盒子"]),
 ("i16-09", T("倒计时器", "A countdown timer", "Un minuteur"), T("按键（btn = 1）后 display 从 5 倒数到 0，到 0 时蜂鸣器 beep 响 3 轮。倒计时期间的按键无效。", "After the button (btn = 1) the display counts from 5 to 0 and the buzzer beeps for 3 ticks. Presses during the countdown are ignored.", "Après l'appui (btn = 1) l'afficheur compte de 5 à 0 et le buzzer sonne 3 tours. Les appuis pendant le décompte sont ignorés."), "countdown",
   ["用 running 记住状态：0 = 空闲，1 = 倒计时或响铃中。", "空闲：按键则 display = 5、running = 1。运行：先倒数，到 0 后响 3 轮再回到空闲。"], ["数字显示不对。", "蜂鸣器的时间不对。"], ["按一次", "按两次", "倒数时又按"]),
 ("i16-10", T("密码锁", "A keypad lock", "Un digicode"), T("密码是 2 5 8。按对三个键依次开锁（open 为 1 一轮）；按错一个键重新开始并记一次错误，错 3 次 alarm 一直为 1。", "The code is 2 5 8. Typing the three keys in order opens the lock (open is 1 for one tick); a wrong key starts over and counts an error; after 3 errors alarm stays 1.", "Le code est 2 5 8. Les trois touches dans l'ordre ouvrent (open vaut 1 un tour) ; une mauvaise touche recommence et compte une erreur ; après 3 erreurs, alarm reste à 1."), "fsm",
   ["用 state 记住已输入几位，用 ok 表示这一键是否正确。", "每个 state 对应一个应该按的键：state 0 → 2，1 → 5，2 → 8。"], ["密码输对了，门没有开。", "不该开锁时开锁了。", "报警器的状态不对。"], ["输对", "输错", "三次错误", "闯入", "重新开始"]),
 ("i16-11", T("电梯", "An elevator", "Un ascenseur"), T("target 是最早的请求楼层（0 表示没有请求）。控制 move（1 上，−1 下，0 停），处理所有请求，没有请求时不要动，也不要冲出 1 到 5 层。", "target is the floor of the oldest request (0 = none). Control move (1 up, −1 down, 0 stop): serve all requests, stay still when there is none, and never leave floors 1 to 5.", "target est l'étage de la plus ancienne demande (0 = aucune). Pilotez move (1 monte, −1 descend, 0 arrêt) : servez toutes les demandes, restez immobile sans demande, ne sortez pas des étages 1 à 5."), "lift",
   ["先让 move = 0，再判断上行和下行。", "下行的条件要同时满足 target ≠ 0。"], ["电梯冲出了楼层范围。", "没有请求时电梯在移动。", "有请求没有被处理。"], ["一个请求", "排队", "晚来的请求", "上下"]),
 ("i16-12", T("巡线小车", "A line-following car", "Une voiture suiveuse de ligne"), T("小车有左、右两个传感器，看见黑线为 1。让 steer 控制转向（−1 向左，1 向右，0 直行），始终跟住黑线。", "The car has a left and a right sensor, 1 when they see the black line. Set steer (−1 left, 1 right, 0 straight) to follow the line.", "La voiture a un capteur gauche et un capteur droit, à 1 quand ils voient la ligne noire. Réglez steer (−1 gauche, 1 droite, 0 tout droit) pour suivre la ligne."), "follow",
   ["左边看见线：向左转（steer = −1）。", "右边看见线：向右转；都没看见：直行（先让 steer = 0）。"], ["小车偏离了黑线。", "小车一直直行，没有转向。"], ["直线", "偏一侧", "缓弯", "渐偏"]),
 ("i16-13", T("急弯巡线", "Sharp curves", "Virages serrés"), T("现在的弯很急。除了 left、right，还有更靠外的 farleft、farright。线偏得越远，转得越大（最大 ±3）。", "The curves are sharp. Besides left and right there are farleft and farright. The farther off the line, the stronger the turn (up to ±3).", "Les virages sont serrés. En plus de left et right, il y a farleft et farright. Plus la ligne est loin, plus le virage est fort (jusqu'à ±3)."), "follow2",
   ["近的传感器转 1，远的传感器转 3。", "把远的规则写在后面，它会覆盖前面的 steer。"], ["小车偏离了黑线太远。", "小车一直直行。"], ["S 形", "波浪", "急弯", "急弯偏一侧"]),
 ("i16-14", T("避障小车", "An obstacle-avoiding car", "Une voiture qui évite les obstacles"), T("传感器 dist 是前方障碍物的距离。让 speed（0-3）和 turn（1 = 换车道）控制小车，不撞上障碍物，开到 100。", "dist is the distance to the obstacle ahead. Control speed (0-3) and turn (1 = change lane) so that the car never hits an obstacle and reaches 100.", "dist est la distance à l'obstacle devant. Pilotez speed (0-3) et turn (1 = changer de voie) pour ne jamais heurter d'obstacle et atteindre 100."), "rover",
   ["距离近就停下并换道，否则前进。", "dist < 12 → speed = 0 且 turn = 1；其他时候 speed = 3 且 turn = 0。"], ["小车撞上了障碍物。", "小车没有开到终点。"], ["一个障碍", "两个障碍", "三个障碍", "障碍很近"]),
 ("i16-15", T("机械臂", "A robot arm", "Un bras robotique"), T("机械臂在 0 度的投放区。找到物体（seen = 1），闭合爪子（claw = 1），带回投放区（zone = 1），张开。底座用 base 每次转 10 度。", "The arm starts at 0 degrees, the drop zone. Find the object (seen = 1), close the claw (claw = 1), carry it back to the zone (zone = 1) and open. Turn the base by 10 degrees with base.", "Le bras part de 0 degré, la zone de dépôt. Trouvez l'objet (seen = 1), fermez la pince (claw = 1), ramenez-le à la zone (zone = 1) et ouvrez. Tournez la base de 10 degrés avec base."), "arm",
   ["爪子张开时：没看到物体就转过去（change base by 10），看到就闭合。", "爪子闭合时：没到投放区就往回转（−10），到了就张开。"], ["物体被放在了别的地方。", "物体没有送到投放区。"], ["40 度", "95 度", "150 度", "25 度"]),
 ("i16-16", T("智能家居：错峰用电", "Smart home: cheap hours", "Maison connectée : heures creuses"), T("price = 0 表示电价便宜。洗衣机一共要运行 3 个小时，必须都在便宜的时段。变量 used 记录已运行的小时数。", "price = 0 means cheap electricity. The washer must run 3 hours in total, all in cheap hours. The variable used counts the hours already run.", "price = 0 signifie électricité bon marché. La machine doit tourner 3 heures au total, toutes aux heures creuses. La variable used compte les heures déjà faites."), "schedule",
   ["先让 washer = 0，再在便宜时段开。", "price = 0 且 used < 3：washer = 1，并且 used 加 1。"], ["洗衣机在电价贵的时候运行了。", "洗衣机运行不足 3 个小时。", "洗衣机运行超过 3 个小时。"], ["夜间", "中午", "晚上", "两段"]),
]
for i, (id_, title, goal, les, hints, msgs, scs) in enumerate(D):
    dev[id_] = {"title": title, "goal": goal, "lesson": les, "hints": hints, "msgs": msgs, "scenarios": scs}
    act(16, i + 1, title, les, "device", {}, None, None, boss=(i == len(D) - 1))

worlds = {"14": {"name": T("数据与编码", "Data and coding", "Données et codage"), "lesson": "bin"},
          "15": {"name": T("网络、安全与人工智能", "Networks, safety and AI", "Réseaux, sécurité et IA"), "lesson": "packets"},
          "16": {"name": T("过程控制与物联网", "Control and IoT", "Contrôle et objets connectés"), "lesson": "scan"}}
projects = {
 "guess": {"name": T("猜数字游戏", "Guess the number", "Devine le nombre"), "text": "设定数字的范围和猜的次数，做成一个猜数字游戏。"},
 "quiz": {"name": T("问答制作器", "Quiz maker", "Créateur de quiz"), "text": "写下自己的题目和选项，做成一个问答游戏。"},
 "pixel": {"name": T("像素动画", "Pixel animation", "Animation en pixels"), "text": "画几张 8 × 8 的图，连起来播放成动画。"},
 "home": {"name": T("智能家居场景", "Smart-home scene", "Scène de maison connectée"), "text": "设定灯和空调的规则，看一天里它们怎样自动工作。"},
 "story": {"name": T("互动故事", "Interactive story", "Histoire interactive"), "text": "写几个场景，让读者的选择决定故事的走向。"},
 "dashboard": {"name": T("数据仪表板", "Data dashboard", "Tableau de bord"), "text": "输入一组数据，自动画出条形图并算出平均数和最大值。"},
}
pdef = {
 "guess": {"title": "猜数字", "max": 20, "tries": 6, "hints": True},
 "quiz": {"title": "我的问答", "qs": [{"q": "一个字节有几位二进制？", "o": ["4", "8", "16"], "a": 1}, {"q": "哪个是网络安全的好习惯？", "o": ["把密码告诉朋友", "每个账号用不同的密码", "点开陌生链接"], "a": 1}, {"q": "二进制 101 等于十进制几？", "o": ["3", "5", "7"], "a": 1}]},
 "pixel": {"fps": 3, "frames": [["00011000", "00111100", "01111110", "01111110", "01111110", "00111100", "00011000", "00000000"], ["00000000", "00011000", "00111100", "00111100", "00111100", "00011000", "00000000", "00000000"], ["00000000", "00000000", "00011000", "00011000", "00011000", "00000000", "00000000", "00000000"]]},
 "home": {"lamp": 30, "heater": 18, "fan": 28},
 "story": {"title": "小机器人的一天", "scenes": [{"text": "小机器人早上醒来，看见窗外在下雨。", "choices": [{"t": "带伞出门", "to": 1}, {"t": "留在家里", "to": 2}]}, {"text": "小机器人带着伞，在路上遇到了一只迷路的小猫。故事结束。", "choices": []}, {"text": "小机器人在家里读了一本编程书，学会了新本领。故事结束。", "choices": []}]},
 "dashboard": {"title": "每天阅读的页数", "rows": [{"label": "周一", "value": 12}, {"label": "周二", "value": 8}, {"label": "周三", "value": 15}, {"label": "周四", "value": 10}, {"label": "周五", "value": 20}]},
}
out = {"worlds": worlds, "projectDefaults": pdef, "lessons": lessons, "acts": acts, "genPrompts": gp, "kindHints": kindHints, "labels": labels, "dev": dev, "projects": projects}
path = os.path.join(os.path.dirname(__file__), "..", "src", "data", "coding-info.json")
with open(path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=0)
print(len(acts), "activities", len(lessons), "lessons", os.path.getsize(path), "bytes")
