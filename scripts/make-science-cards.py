#!/usr/bin/env python3
"""
Makes src/data/science-cards.json: the hand-written cards (src/data/science-cards-handwritten.json, ids g*-nn) + cards generated from the tables in
scripts/science/*.py (ids x-<table>-<n>). Every card: a question, the right answer, 3 wrong ones taken from the same table, a short "did you know" sentence,
and the grades it is for (g..gx: a card can be used for several grades; a child never gets the same card twice).
APPEND ONLY: rows are only added at the END of a table, so that the ids of the cards a child already had keep their meaning.
Run:  python3 scripts/make-science-cards.py
"""
import json, os, random, sys, zlib
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(HERE, 'science'))
import geo, life, matter, hist, hand, phys, fill

base = json.load(open(os.path.join(ROOT, 'src/data/science-cards-handwritten.json'), encoding='utf-8'))
periodic = json.load(open(os.path.join(ROOT, 'src/data/periodic.json'), encoding='utf-8'))['elements']
TOPICS = dict(base['topics'])
TOPICS.update({'animal': '动物', 'plant': '植物', 'body': '人体', 'country': '世界各国', 'china': '中国地理', 'terrain': '山川与自然景观', 'people': '人物与发明', 'dynasty': '朝代与大事', 'culture': '节日与节气', 'poem': '诗词与名著', 'story': '成语与传说', 'element': '化学元素', 'substance': '化学物质', 'unit': '单位与仪器', 'space': '太阳系', 'garbage': '环保与垃圾分类'})
DOMAINS = {
    'nature': ['nature', 'matter', 'earth', 'tech', 'phys', 'chem', 'element', 'substance', 'unit', 'space', 'garbage'],
    'life': ['life', 'bio', 'health', 'animal', 'plant', 'body'],
    'hist': ['hist', 'people', 'dynasty', 'culture', 'poem', 'story'],
    'geo': ['geo', 'country', 'china', 'terrain'],
}
cards = list(base['cards'])
seen_q = {c['q'] for c in cards}
count = {}

def rows(text): return [l.split('|') for l in text.strip().split('\n') if l.strip()]
def grades(s, default=(3, 9)):
    if not s: return default
    s = s.strip()
    if '-' not in s: return int(s), 9
    a, b = s.split('-')
    return int(a), int(b)

def add(code, topic, q, a, pool, e, g, gx, k=3, ban=()):
    """Makes one card and returns it (None when the question exists already or there are not enough wrong choices).
    The wrong choices are drawn with a generator seeded by the question itself, so a change in one table never moves the choices of another card.
    ban = texts that must never be a wrong choice of this card (they are also true, or confusable)."""
    if q in seen_q: return None
    banned = set(ban)
    opts = [x for x in dict.fromkeys(pool) if x != a and x and x not in banned]
    if len(opts) < k:
        print('WARNING: not enough wrong choices, card skipped (the ids after it would move):', code, q); return None
    w = random.Random(zlib.crc32((code + '|' + q).encode('utf-8')) ^ 20261112).sample(opts, k)
    count[code] = count.get(code, 0) + 1
    card = {'id': f'x-{code}-{count[code]:03d}', 'g': g, 'gx': gx, 't': topic, 'q': q, 'a': a, 'w': w, 'e': e}
    cards.append(card)
    seen_q.add(q)
    return card

def fun_parts(name, fun):
    """(text as a choice, sentence for the explanation). A fun fact that starts with "~" is a sentence of its own."""
    if fun.startswith('~'): return fun[1:], fun[1:]
    return fun, name + fun

# ---------------------------------------------------------------- geography
CON = ['亚洲', '欧洲', '非洲', '北美洲', '南美洲', '大洋洲']
AMBIG = {'土耳其', '俄罗斯', '埃及'}   # across two continents: no "which continent" card
C = rows(geo.COUNTRIES)
by_con = {}
for n, cap, con, fact in C: by_con.setdefault(con, []).append((n, cap))
for n, cap, con, fact in C:
    g, gx = (1, 9) if n in geo.POPULAR else (3, 9) if n in geo.KNOWN else (5, 9)
    where = f'{n}跨两个大洲，通常归入{con}' if n in AMBIG else f'{n}位于{con}'
    e = (f'{cap}是{n}的首都，{where}。' if cap != n else f'{n}的首都就是{n}本身，{where}。') + (f'{n}{fact}。' if fact else '')
    same = [(m, c) for m, c in by_con[con] if m != n]
    if cap != n:
        add('cap', 'country', f'{n}的首都是哪座城市？', cap, [c for m, c in same], e, g, gx)
        add('rev', 'country', f'{cap}是哪个国家的首都？', n, [m for m, c in same], e, min(g + 1, 9), gx)
    if n not in AMBIG:
        add('con', 'country', f'{n}位于哪个大洲？', con, CON, e, g, gx)
    if fact:
        add('cf', 'country', f'下面哪个国家{fact}？', n, [m for m, c, cc, f in C if f and m != n], e, max(g, 3), gx)

P = rows(geo.PROVINCES)
for name, ab, cap, reg in P:
    e = f'{name}简称“{ab}”' + (f'，省会（首府）是{cap}' if cap and cap != name else '') + (f'，属于{reg}地区' if reg else '') + '。'
    if cap and cap != name and reg:
        add('pc', 'china', f'{name}的省会是哪座城市？', cap, [c for n, a, c, r in P if c and c != name and c != cap], e, 3, 9)
        add('pr', 'china', f'{cap}是哪个省（自治区）的省会？', name, [n for n, a, c, r in P if n != name], e, 4, 9)
    add('pa', 'china', f'{name}的简称是什么？', ab, [a for n, a, c, r in P if a != ab], e, 4, 9)
    add('pb', 'china', f'“{ab}”是中国哪个省级行政区的简称？', name, [n for n, a, c, r in P if n != name], e, 5, 9)
    if reg: add('pg', 'china', f'{name}位于中国的哪个地区？', reg, ['华北', '东北', '华东', '华中', '华南', '西南', '西北'], e, 6, 9)
PL = rows(geo.PLACES)
for name, where, fact in PL:
    add('pl', 'china', f'{name}在哪里？', where, [w for n, w, f in PL if w != where], f'{name}在{where}。{name}{fact}。', 2, 9)
F = rows(geo.FEATURES)
KIND = {'山峰': '哪座山峰', '山脉': '哪条山脉', '河流': '哪条河流', '湖泊': '哪个湖泊', '沙漠': '哪个沙漠', '岛屿': '哪个岛屿'}   # a kind with fewer than 4 members asks "哪个自然景观"（all names are the wrong choices）
N_FEATURES_FIRST = 33   # rows added later get their own id code ('fk': 'fc' is also used by the festival cards, so a new 'fc' would move their ids)
for fi, (name, kind, con, fact) in enumerate(F):
    e = f'{name}（{kind}）位于{con}，{fact}。'
    if name not in AMBIG and name not in ('里海', '乌拉尔山脉'):
        add('fc' if fi < N_FEATURES_FIRST else 'fk', 'terrain', f'{name}位于哪个大洲？', con, CON, e, 4, 9)
    pool = [n for n, k, c, f in F if k == kind and n != name]
    if len(pool) < 3 or kind not in KIND: pool = [n for n, k, c, f in F if n != name]; word = '哪个自然景观'
    else: word = KIND[kind]
    add('ff', 'terrain', f'下面{word}{fact}？', name, pool, e, 4, 9)

# ---------------------------------------------------------------- life
A = [r for r in rows(life.ANIMALS)]
CLS = sorted({r[1] for r in A})
opt_of = {r[0]: fun_parts(r[0], r[4])[0] for r in A}
for name, cls, hab, food, fun, gr in A:
    g, gx = grades(gr)
    text, sent = fun_parts(name, fun)
    e = f'{name}属于{cls}，主要生活在{hab}。{sent}。'
    add('ac', 'animal', f'{name}属于哪一类动物？', cls, CLS, e, g, gx)
    add('aw', 'animal', f'下面哪种动物属于{cls}？', name, [r[0] for r in A if r[1] != cls], e, g, gx)
    # habitat: a wrong choice is a place where the animal does NOT live
    assert hab in life.HAB_TRUE, (name, hab)
    true_h = set(life.HAB_TRUE[hab]) | set(life.HAB_X.get(name, '').split())
    add('ah', 'animal', f'{name}主要生活在哪里？', hab, [h for h in life.HAB_ALL if h not in true_h], e, g, gx)
    if food:
        assert name in life.FOOD_X, name
        codes = life.FOOD_X[name]
        if 'm' in codes: codes += 'ikp'   # flesh: fish, insects and small shrimps count as meat, so they are never the wrong choice of a meat eater
        pool = [lab for lab, c in life.FOOD_ALL.items() if c not in codes and lab not in food and food not in lab]
        add('af', 'animal', f'{name}主要吃什么？', food, pool, e, g, gx)
    add('an', 'animal', f'关于{name}，下面哪句话说得对？', text, [opt_of[r[0]] for r in A if r[0] != name], e, g, gx)
PLn = rows(life.PLANTS)
USE = {'蔬菜', '水果', '粮食作物', '花卉', '经济作物', '药用植物'}
LIFE_KINDS = sorted({r[1] for r in PLn} - USE)
USE_KINDS = sorted(USE)
FILLER = ['苔藓植物', '蕨类植物', '藻类植物', '沙漠植物']   # clearly wrong choices for a plant whose own dimension has too few wrong ones left
BOTH = {'西红柿'}   # a vegetable AND a fruit: never a card about its type, never a wrong choice about types
def plant_true(name, ty): return {ty} | set(life.PLANT_X.get(name, '').split())
opt_p = {r[0]: fun_parts(r[0], r[3])[0] for r in PLn}
for name, ty, feat, fun, gr in PLn:
    g, gx = grades(gr)
    text, sent = fun_parts(name, fun)
    e = f'{name}{feat}，属于{ty}。{sent}。'
    kind = USE_KINDS if ty in USE else LIFE_KINDS
    tr = plant_true(name, ty)
    if name not in BOTH:
        same = [c for c in kind if c not in tr]
        add('pt', 'plant', f'{name}属于哪一类植物？', ty, same if len(same) >= 3 else same + [c for c in FILLER if c not in tr], e, g, gx)
        add('pw', 'plant', f'下面哪种植物属于{ty}？', name, [r[0] for r in PLn if r[1] in kind and r[1] != ty and r[0] not in BOTH and ty not in plant_true(r[0], r[1])], e, g, gx)
    add('pn', 'plant', f'关于{name}，下面哪句话说得对？', text, [opt_p[r[0]] for r in PLn if r[0] != name], e, g, gx)
B = rows(life.BODY)
opt_b = {r[0]: fun_parts(r[0], r[2])[0] for r in B}
for name, fn, fun, gr in B:
    g, gx = grades(gr)
    text, sent = fun_parts(name, fun)
    e = f'{name}的主要作用是{fn}。{sent}。'
    add('bf', 'body', f'{name}的主要作用是什么？', fn, [r[1] for r in B], e, g, gx)
    add('bw', 'body', f'下面哪个器官的主要作用是{fn}？', name, [r[0] for r in B], e, g, gx)
    add('bn', 'body', f'关于{name}，下面哪句话说得对？', text, [opt_b[r[0]] for r in B if r[0] != name], e, g, gx)

# ---------------------------------------------------------------- nature: elements, units, chemistry, apparatus, space, garbage
CATS = {'alkali': '碱金属', 'alkaline': '碱土金属', 'transition': '过渡金属', 'post': '其他金属', 'metalloid': '类金属', 'nonmetal': '非金属', 'halogen': '卤素', 'noble': '稀有气体', 'lanthanide': '镧系元素', 'actinide': '锕系元素'}
# classes that are ALSO true (or a matter of the book) for an element of a class: never a wrong choice of the "which class" card
CAT_ALSO = {'halogen': ['nonmetal'], 'noble': ['nonmetal'], 'metalloid': ['nonmetal', 'post'], 'post': ['transition', 'metalloid'], 'transition': ['post', 'lanthanide'],
            'lanthanide': ['transition'], 'actinide': ['transition'], 'nonmetal': [], 'alkali': [], 'alkaline': []}
CAT_EXTRA = {34: ['metalloid'], 21: ['lanthanide'], 39: ['lanthanide']}   # selenium; scandium and yttrium are counted with the rare earths
EL = periodic
jr = [e for e in EL if e['junior']]
for e in EL:
    n = e['n']
    pool_n = [x['zh'] for x in (jr if e['junior'] else EL) if x['n'] != n]
    pool_s = [x['sym'] for x in (jr if e['junior'] else EL) if x['n'] != n]
    g, gx = (8, 9) if e['junior'] and n <= 20 else (9, 9)
    ev = f"{e['zh']}（{e['en']}）：元素符号 {e['sym']}，原子序数 {n}，相对原子质量约 {e['mass']}，属于{CATS[e['cat']]}。"
    add('es', 'element', f"元素符号 {e['sym']} 表示的元素是？", e['zh'], pool_n, ev, g, gx)
    add('en', 'element', f"{e['zh']}的元素符号是？", e['sym'], pool_s, ev, g, gx)
    if n <= 36: add('ez', 'element', f'原子序数是 {n} 的元素是？', e['zh'], [x['zh'] for x in EL if x['n'] <= 36 and x['n'] != n], ev, 9, 9)
    also = set(CAT_ALSO[e['cat']]) | set(CAT_EXTRA.get(n, []))
    q_ec = f"{e['zh']}（{e['sym']}）属于哪一类元素？" if n < 104 else f"{e['zh']}（{e['sym']}）按它在周期表中的位置，属于哪一类元素？"
    add('ec', 'element', q_ec, CATS[e['cat']], [v for k, v in CATS.items() if k not in also], ev, 9, 9)
EF = rows(matter.ELEMENT_FACTS)
for zh, fact in EF:
    add('ef', 'element', f'下面哪种元素{fact}？', zh, [z for z, f in EF if z != zh], f'{zh}{fact}。', 8, 9)
U = rows(matter.UNITS)
for q_, u, sym, gr in U:
    g, gx = grades(gr)
    if q_ == '温度':   # the SI unit of temperature is the kelvin: the card is about the everyday unit
        e = f'温度的常用单位是{u}，符号是 {sym}；国际单位制中温度的单位是开尔文（K）。'
        add('uu', 'unit', '温度的常用单位是什么？', u, [x[1] for x in U], e, g, gx)
        add('uq', 'unit', f'“{u}”是哪个物理量的单位？', q_, [x[0] for x in U if x[1] != u], e, g, gx)
        add('us', 'unit', '温度的常用单位符号是什么？', sym, [x[2] for x in U], e, g, gx)
        continue
    e = f'{q_}的国际单位是{u}，符号是 {sym}。'
    add('uu', 'unit', f'{q_}的国际单位是什么？', u, [x[1] for x in U], e, g, gx)
    add('uq', 'unit', f'“{u}”是哪个物理量的单位？', q_, [x[0] for x in U if x[1] != u], e, g, gx)
    add('us', 'unit', f'{q_}的单位符号是什么？', sym, [x[2] for x in U], e, g, gx)
S = rows(matter.SUBSTANCES)
for name, formula, note, gr in S:
    g, gx = grades(gr)
    e = f'{name}的化学式是 {formula}。{note}。' if note else f'{name}的化学式是 {formula}。'   # a note is a sentence of its own
    add('sf', 'substance', f'{name}的化学式是什么？', formula, [x[1] for x in S], e, g, gx)
    add('sn', 'substance', f'化学式 {formula} 表示的物质是什么？', name, [x[0] for x in S], e, g, gx)
AP = rows(matter.APPARATUS)
CONF = [{'试管', '烧杯', '锥形瓶'}, {'放大镜', '显微镜'}, {'漏斗', '玻璃棒'}]   # apparatus that can do each other's job: never wrong choices of one another
def confusable(n): return set().union(*[g for g in CONF if n in g]) if any(n in g for g in CONF) else {n}
for name, use, gr in AP:
    g, gx = grades(gr)
    e = f'{name}是用来{use}的。'
    cf = confusable(name)
    add('au', 'unit', f'{name}是用来做什么的？', use, [x[1] for x in AP if x[0] not in cf], e, g, gx)
    add('an2', 'unit', f'下面哪种仪器是用来{use}的？', name, [x[0] for x in AP if x[0] not in cf], e, g, gx)
BO = rows(matter.BODIES)
for name, fact in BO:
    e = f'{name}{fact}。'
    add('bo', 'space', f'下面哪个天体{fact}？', name, [x[0] for x in BO], e, 1, 9)
    add('bt', 'space', f'{name}有什么特点？', fact, [x[1] for x in BO], e, 3, 9)
GA = rows(matter.GARBAGE)
BINS = ['可回收物', '有害垃圾', '厨余垃圾', '其他垃圾']
for item, cat in GA:
    add('ga', 'garbage', f'{item}应该投进哪个垃圾桶？', cat, BINS, f'{item}属于{cat}，投进对应的垃圾桶，才能更好地回收和处理。', 1, 7)

# ---------------------------------------------------------------- history and humanities
PE = rows(hist.PEOPLE)
for name, deed, gr in PE:
    g, gx = grades(gr)
    e = f'{name}{deed}。'
    add('pq', 'people', f'谁{deed}？', name, [x[0] for x in PE], e, g, gx)
    add('pd', 'people', f'{name}的主要事迹或成就是什么？', deed, [x[1] for x in PE], e, g, gx)
D = rows(hist.DYNASTIES)
# a dynasty with more than one capital: the card names the period, and a city that was also a capital is never a wrong choice
DQ = {'汉朝': '西汉', '宋朝': '北宋', '明朝': '明朝初年'}
DEX = {'汉朝': ['洛阳'], '唐朝': ['洛阳'], '宋朝': ['杭州'], '元朝': ['北京'], '明朝': ['北京', '大都']}
CAPNOTE = {'汉朝': '长安（西汉的都城，东汉定都洛阳）', '宋朝': '开封（北宋的都城，南宋定都临安）', '明朝': '南京（建立时的都城，后来迁都北京）'}
for name, founder, cap, fun in D:
    e = f'{name}的开国皇帝是{founder}，都城在{CAPNOTE.get(name, cap)}。{name}{fun}。'
    add('df', 'dynasty', f'{name}的开国皇帝是谁？', founder, [x[1] for x in D], e, 4, 9)
    add('dc', 'dynasty', f'{DQ.get(name, name)}的都城在哪里？', cap, [x[2] for x in D] + ['洛阳', '北京', '杭州'], e, 5, 9, ban=DEX.get(name, []))
    add('dw', 'dynasty', f'下面哪个朝代的开国皇帝是{founder}？', name, hist.DYNASTY_ORDER, e, 4, 9)
    add('dn', 'dynasty', f'下面哪个朝代{fun}？', name, hist.DYNASTY_ORDER, e, 4, 9)
O = hist.DYNASTY_ORDER
for i, d in enumerate(O):
    if i + 1 < len(O): add('do', 'dynasty', f'中国历史上，{d}的后面是哪个朝代？', O[i + 1], [x for x in O if x != d], f'中国历史上朝代的顺序是：{"、".join(O)}。', 4, 9)
    if i > 0: add('dp', 'dynasty', f'中国历史上，{d}的前面是哪个朝代？', O[i - 1], [x for x in O if x != d], f'中国历史上朝代的顺序是：{"、".join(O)}。', 4, 9)
EV = rows(hist.EVENTS)
yrs = [int(y) for n, y in EV]
fmt = lambda y: f'公元前 {-y} 年' if y < 0 else f'{y} 年'   # (written without a space before it: 发生在公元前 221 年)
for name, y in EV:
    y = int(y)
    cand = sorted({y + d for d in (-1, 1, -2, 2, -3, 3, -5, 5, -10, 10, -20, 20, -50, 50) if y + d != y and (y + d < 0) == (y < 0)} | {v for v in yrs if v != y})
    near = sorted(cand, key=lambda v: abs(v - y))[:8]
    if name.endswith('爆发'): qv, ev_ = f'{name}于哪一年？', f'{name}于{"" if y < 0 else " "}{fmt(y)}。'   # (not "爆发发生在")
    else: qv, ev_ = f'{name}发生在哪一年？', f'{name}发生在{"" if y < 0 else " "}{fmt(y)}。'
    add('ev', 'dynasty', qv, fmt(y), [fmt(v) for v in near], ev_, 5, 9)
FE = rows(hist.FESTIVALS)
MOD = {'国庆节', '劳动节', '儿童节', '教师节', '植树节', '妇女节', '七夕节'}   # festivals whose line is a meaning, not a list of customs
FESTBAN = {'春节': ['除夕'], '除夕': ['春节', '中秋节'], '中秋节': ['除夕']}   # festivals that share customs / food with each other
for name, date, custom, food in FE:
    e = f'{name}是{date}，' + ('意义是：' if name in MOD else '习俗有：') + f'{custom}。' + (f'传统食物是{food}。' if food else '')
    bf = set(FESTBAN.get(name, []))
    add('fd', 'culture', f'{name}是什么时候？', date, [x[1] for x in FE], e, 1, 9)
    add('fr', 'culture', f'{date}是哪个节日？', name, [x[0] for x in FE], e, 2, 9)
    add('fc', 'culture', f'{name}的习俗或意义是什么？', custom, [x[2] for x in FE if x[0] not in bf], e, 2, 9)
    if food: add('ff2', 'culture', f'{name}的传统食物是什么？', food, [x[3] for x in FE if x[3] and x[0] not in bf], e, 1, 9)
ST = rows(hist.SOLAR_TERMS)
SEA = ['春季', '夏季', '秋季', '冬季']
for i, (name, sea, date, note) in enumerate(ST):
    e = f'{name}是{sea}的节气，在公历 {date}，{note}。'
    nxt = ST[(i + 1) % 24][0]
    add('ts', 'culture', f'{name}是哪个季节的节气？', sea, SEA, e, 3, 9)
    add('td', 'culture', f'{name}大约在公历什么时候？', date, [x[2] for x in ST], e, 5, 9)
    add('tn', 'culture', f'二十四节气中，{name}的下一个节气是什么？', nxt, [x[0] for x in ST if x[0] != name], e, 3, 9)
    add('tf', 'culture', f'下面哪个节气{note}？', name, [x[0] for x in ST], e, 3, 9)
Z = hist.ZODIAC
for i, z in enumerate(Z):
    ez = f'十二生肖的顺序是：{"、".join(Z)}。'
    add('zo', 'culture', f'十二生肖中，排在“{z}”后面的是什么？' if i < 11 else '十二生肖循环排列，“猪”的下一个是什么？', Z[(i + 1) % 12], [x for x in Z if x != z], ez, 1, 5)
    add('zn', 'culture', f'十二生肖里，排在第 {i + 1} 位的是什么？', z, Z, ez, 1, 5)
CL = rows(hist.CLASSICS)
for name, author, dyn, chars in CL:
    e = f'《{name}》的作者是{author}（{dyn}）。' + (f'书中有{chars}。' if chars else '')
    add('ka', 'poem', f'《{name}》的作者是谁？', author, [x[1] for x in CL], e, 4, 9)
    add('kd', 'poem', f'《{name}》是哪个朝代的作品？', dyn, [x[2] for x in CL] + ['唐代', '宋代', '清代'], e, 5, 9, ban=['宋代'] if dyn == '北宋' else [])
    if chars: add('kc', 'poem', f'{chars.split("、")[0]}是哪部名著里的人物？', name, [x[0] for x in CL], e, 4, 9)
PO = rows(hist.POEMS)
SAME_TITLE = {'绝句', '春日', '清明', '江南', '梅花', '元日', '相思'}   # titles that several poets used: the first line says which poem is meant
for i, (title, author, dyn, line) in enumerate(PO):
    g = 1 if i < 9 else 3
    e = f'《{title}》是{dyn if not author.startswith(dyn.rstrip("代")) else ""}{author}写的：“{line}”。'   # (not 北朝北朝民歌 / 汉代汉乐府)
    tt = f'《{title}》（“{line.split("，")[0]}”）' if title in SAME_TITLE else f'《{title}》'
    add('oa', 'poem', f'“{line}”出自谁的诗？', author, [x[1] for x in PO], e, g, 9)
    add('ot', 'poem', f'“{line}”出自哪首诗？', title, [x[0] for x in PO], e, g, 9)
    add('ob', 'poem', f'{tt}的作者是谁？', author, [x[1] for x in PO], e, g, 9)
    add('od', 'poem', f'{tt}的作者生活在哪个朝代？', dyn, [x[2] for x in PO], e, g + 1, 9)
SO = rows(hist.STORIES)
SBAN = {'三顾茅庐': ['诸葛亮'], '草船借箭': ['曹操'], '负荆请罪': ['蔺相如'], '完璧归赵': ['廉颇']}   # people who are also in the story
for story, person, gist in SO:
    e = f'“{story}”：{person}，{gist}。'
    add('sp', 'story', f'“{story}”讲的是谁的故事？', person, [x[1] for x in SO], e, 1, 7, ban=SBAN.get(story, []))
    add('sg', 'story', f'“{story}”这个故事讲了什么？', gist, [x[2] for x in SO], e, 2, 8)

# ---------------------------------------------------------------- hand-written lines
for line in hand.HAND.strip().split('\n'):
    t, q, a, w, e, gr = [x.strip() for x in line.split('‖')]
    g, gx = grades(gr)
    ws = [x.strip() for x in w.split('|')]
    assert len(ws) == 3 and a not in ws and t in TOPICS, line
    card = add('hd', t, q, a, ws, e, g, gx)
    if card: card['w'] = ws   # (the wrong choices are exactly the ones written; a line whose question exists already adds nothing and changes no other card)

skipped = []
# ---------------------------------------------------------------- junior-high physics (circuits, rules ...), chemistry, biology (hand-written)
for code, block in (('hp', phys.PHYS), ('hc', phys.CHEM), ('hb', phys.BIO), ('f1', fill.GEO1), ('fn', fill.NAT1), ('f9', fill.BIO9)):
    for line in block.strip().split('\n'):
        t, q, a, w, e, gr = [x.strip() for x in line.split('‖')]
        g, gx = grades(gr)
        ws = [x.strip() for x in w.split('|')]
        assert len(ws) == 3 and a not in ws and t in TOPICS and len(e) <= 120 and len(q) <= 90, line
        card = add(code, t, q, a, ws, e, g, gx)
        if card: card['w'] = ws   # (see above: never touch the previous card when the line was skipped)
        else: skipped.append((code, q))

# ---------------------------------------------------------------- write
for c in cards:
    c.setdefault('gx', c['g'])
    assert len(set([c['a'], *c['w']])) == 4 and c['e'] and len(c['e']) <= 120, c
out = {'note': '科学知识卡：手写卡（g*-nn）+ 由 scripts/science 里的表格生成的卡（x-*）。每张卡有问题、正确答案、3 个干扰项、一句“小知识”，以及适合的年级范围（g～gx）。内容是样品，请校对。', 'topics': TOPICS, 'domains': DOMAINS, 'cards': cards}
json.dump(out, open(os.path.join(ROOT, 'src/data/science-cards.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
if skipped: print('lines skipped because the same question exists:', skipped)
print(len(cards), 'cards;', os.path.getsize(os.path.join(ROOT, 'src/data/science-cards.json')) // 1024, 'KB')
dom_of = {t: d for d, ts in DOMAINS.items() for t in ts}
for g in range(1, 10):
    pool = [c for c in cards if c['g'] <= g <= c['gx']]
    print(g, len(pool), {d: sum(1 for c in pool if dom_of[c['t']] == d) for d in DOMAINS})
