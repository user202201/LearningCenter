// The corpus of 编程 text coding (suite 86): programs of the small Python-like language. Each entry is { src, input? }.
// The suite runs every program with the interpreter of the app AND with a real python3 (when it exists) and compares stdout.
// HAND = written by hand, topic by topic. GENERATED = random expression programs from a seed (ints, floats, strings, lists, formats).
// BROKEN = programs with ONE mistake: { src, kind, line } (the kind and the line number of the message).
const HAND = [];
const add = (src, input) => HAND.push({ src: src.replace(/^\n/, ''), input });

// ---------- print, arithmetic, numbers ----------
add(`print("Hello")\nprint('world')\nprint("a", "b", 3)`);
add(`print(1 + 2 * 3)\nprint((1 + 2) * 3)\nprint(10 - 4 - 3)\nprint(2 ** 3 ** 2)\nprint(-2 ** 2)\nprint((-2) ** 2)`);
add(`print(7 / 2)\nprint(7 // 2)\nprint(-7 // 2)\nprint(7 // -2)\nprint(-7 // -2)\nprint(7 % 3)\nprint(-7 % 3)\nprint(7 % -3)\nprint(-7 % -3)`);
add(`print(7.5 // 2)\nprint(-7.5 // 2)\nprint(7.5 % 2)\nprint(-7.5 % 2)\nprint(7.5 % -2)\nprint(1e3)\nprint(2.5e-3)`);
add(`print(2 ** 10)\nprint(2 ** 100)\nprint(10 ** 20)\nprint(2 ** -1)\nprint(2 ** 0.5)\nprint(0 ** 0)\nprint(9 ** 0.5)`);
add(`print(0.1 + 0.2)\nprint(0.1 * 3)\nprint(1 / 3)\nprint(2 / 3)\nprint(10 / 4)\nprint(1e16)\nprint(1e15)\nprint(123456789012345678.0)\nprint(0.0001)\nprint(0.00001)`);
add(`print(100 / 3)\nprint(1e22)\nprint(1.5e300 * 1e10)\nprint(float("inf"))\nprint(-float("inf"))\nprint(5.0)\nprint(-0.0)\nprint(3.0 * 2)\nprint(1_000_000)`);
add(`print(3 == 3.0)\nprint(1 < 2 < 3)\nprint(1 < 3 < 2)\nprint(True + True)\nprint(True * 5)\nprint(5 > 3 and 2 > 1)\nprint(5 > 3 or 1 / 1 > 0)\nprint(not 5)\nprint(not 0)`);
add(`x = 5\ny = 3\nprint(x + y, x - y, x * y, x / y, x // y, x % y, x ** y)`);
add(`a = b = 7\nprint(a, b)\na, b = 1, 2\na, b = b, a\nprint(a, b)\nx, y, z = 1, 2, 3\nprint(x + y + z)`);
add(`n = 10\nn += 5\nn -= 3\nn *= 2\nn //= 5\nn **= 3\nn %= 7\nprint(n)\nm = 7\nm /= 2\nprint(m)`);
add(`print(abs(-5), abs(3.5), abs(-0.0))\nprint(min(3, 1, 2), max(3, 1, 2))\nprint(min([4, 2, 8]), max([4, 2, 8]))\nprint(min("b", "a"), max("apple", "banana"))`);
add(`print(round(2.5), round(3.5), round(-2.5), round(0.5), round(1.5))\nprint(round(2.675, 2), round(3.14159, 3), round(1234, -2), round(5))\nprint(round(2.0), round(7.123456789, 4))`);
add(`print(int(3.9), int(-3.9), int("42"), int(" 7 "), int(True))\nprint(float(3), float("2.5"), float("1e3"))\nprint(str(3), str(3.0), str(True), str(None))`);
add(`print(divmod(17, 5), divmod(-17, 5), divmod(17, -5))\nprint(pow(2, 10), pow(2, 10, 1000), pow(3, 4, 5))`);
add(`print(sum([1, 2, 3]), sum([0.1, 0.2, 0.3]), sum([0.1] * 10), sum(range(101)))\nprint(sum([1, 2], 10), sum([]), sum([1.5, 2]))`);
add(`print(int(2.5 + 2.5), 7 // 2 * 2 + 7 % 2)\nprint(10 / 2)\nprint(type(10 / 2) == float)\nprint(isinstance(3, int), isinstance(3.0, int), isinstance("a", str), isinstance(True, int))`);
add(`big = 1\nfor i in range(1, 26):\n    big *= i\nprint(big)\nprint(big // 10 ** 10)\nprint(len(str(big)))`);
add(`print(1e308 * 10)\nprint(-1e308 * 10)\nprint(1 / 3 * 3)\nprint(0.1 + 0.7)\nprint(4.35 * 100)\nprint(1.1 * 1.1)`);
add(`print(255 == 0xff, 0b101, 0o17)\nprint(bin(10), hex(255))\nprint(int("101", 2), int("ff", 16))`);
add(`print(3 * "ab", "ab" * 3, "-" * 20, [0] * 4, [1, 2] * 2)\nprint("a" * 0, "a" * -1, [1] * 0)`);
add(`print(10 % 3 == 1, 10 // 3 == 3)\nprint(12 % 5, -12 % 5, 12 % -5)\nprint(5 // 2, -5 // 2, 5 // -2)\nprint(5.0 // 2, 5 / 2)`);
add(`print(17 // 5, 17 % 5)\nprint(17.0 // 5, 17.0 % 5)\nprint(2 ** 3 ** 0)\nprint(-3 ** 2)\nprint(--3, -(-3), +3)`);

// ---------- strings ----------
add(`s = "Hello, World"\nprint(len(s), s.upper(), s.lower(), s.swapcase())\nprint(s[0], s[-1], s[7], s[-5])`);
add(`s = "abcdefghij"\nprint(s[2:5], s[:3], s[7:], s[-3:], s[:-3], s[::2], s[::-1], s[1:8:3], s[8:2:-2])\nprint(s[100:], s[-100:2], s[5:2])`);
add(`s = "  padded text  "\nprint("[" + s.strip() + "]", "[" + s.lstrip() + "]", "[" + s.rstrip() + "]")\nprint("xxhixx".strip("x"), "xxhixx".lstrip("x"), "xxhixx".rstrip("x"))`);
add(`s = "a,b,,c"\nprint(s.split(","))\nprint("a b  c".split())\nprint("  lead trail  ".split())\nprint("a-b-c-d".split("-", 2))\nprint("".split(","))\nprint("".split())`);
add(`words = ["I", "like", "python"]\nprint(" ".join(words))\nprint("-".join(["a", "b", "c"]))\nprint("".join(["x", "y"]))\nprint(",".join(str(i) for i in range(5)))`);
add(`s = "banana"\nprint(s.replace("a", "o"), s.replace("an", "AN"), s.replace("a", "o", 2), s.replace("x", "y"))\nprint(s.count("a"), s.count("an"), s.count("z"))`);
add(`s = "banana"\nprint(s.find("na"), s.find("z"), s.find("a", 2), s.rfind("a"), s.index("n"))\nprint("na" in s, "z" in s, "z" not in s)`);
add(`s = "hello world"\nprint(s.capitalize(), s.title(), "HELLO".capitalize())\nprint(s.startswith("he"), s.endswith("ld"), s.startswith("x"))`);
add(`print("123".isdigit(), "12a".isdigit(), "".isdigit(), "abc".isalpha(), "ab1".isalpha(), "ab1".isalnum(), " ".isspace())\nprint("ABC".isupper(), "abc".isupper(), "abc".islower(), "Abc".islower())`);
add(`print("5".zfill(3), "-5".zfill(4), "abc".center(9, "*"), "abc".ljust(6, "."), "abc".rjust(6, "."))`);
add(`print("a" < "b", "apple" < "banana", "Zebra" < "apple", "abc" == "abc", "abc" != "abd", "a" < "ab")\nprint(ord("A"), ord("a"), chr(66), chr(97), ord("0"))`);
add(`s = "Hello"\nfor ch in s:\n    print(ch, end="-")\nprint()\nfor i in range(len(s)):\n    print(i, s[i])`);
add(`s = "madam"\nprint(s == s[::-1])\nt = "python"\nprint(t == t[::-1])\nprint("".join(reversed(t)))`);
add(`print("it's", 'say "hi"', "tab\\there", "new\\nline", "back\\\\slash")\nprint(repr("it's"), repr('say "hi"'), repr("a\\nb"), repr("plain"))`);
add(`print("""triple\nquoted""")\nprint('''another\none''')`);
add(`name = "Ann"\nage = 12\nprint("Name: " + name + ", age: " + str(age))\nprint("Name:", name, "age:", age, sep=" | ")\nprint("no newline", end="")\nprint(" ... continued")\nprint("a", "b", sep="")\nprint(end="")\nprint()`);
add(`s = "one two three"\nparts = s.split(" ")\nprint(parts, len(parts), parts[1], parts[-1])\nprint(s.partition(" "))\nprint("a=b=c".partition("="))\nprint("abc".partition("x"))`);
add(`print("%d + %d = %d" % (1, 2, 3))\nprint("%s is %d years" % ("Tom", 9))\nprint("%.2f" % 3.14159, "%5.1f|" % 2.55, "%05d" % 42, "%-5d|" % 42, "%x" % 255, "100%%" % ())`);
add(`print("{} and {}".format("a", "b"))\nprint("{0} {1} {0}".format("x", "y"))\nprint("{:.2f}".format(2.0 / 3))\nprint("{name} is {age}".format(name="Bo", age=7))\nprint("{:>6}|{:<6}|{:^6}|".format("r", "l", "c"))`);
add(`print("abc" + "def", "abc" * 2 + "!")\nx = "5"\ny = "6"\nprint(x + y, int(x) + int(y))\nprint("1" + "1" == "11")`);
add(`text = "The quick brown fox"\nprint(len(text.split()))\nprint(text.lower().count("o"))\nprint(text[4:9])\nprint([w[0] for w in text.split()])\nprint("".join(w[0] for w in text.split()))`);
add(`s = "Hello World"\nvowels = 0\nfor c in s.lower():\n    if c in "aeiou":\n        vowels += 1\nprint(vowels)\nprint(sum(1 for c in s if c.isupper()))`);
add(`print("中文", len("中文"), "中文"[0], "你好".upper(), "a中b".find("b"), "中" in "中文")\nprint("汉字".replace("字", "语"))`);
add(`s = "a1b2c3"\nprint("".join(c for c in s if c.isdigit()))\nprint("".join(c for c in s if c.isalpha()))\nprint(sum(int(c) for c in s if c.isdigit()))`);
add(`print("hello"[1], "hello"[-1], "hello"[1:3], "hello"[:0] == "", "hello"[::-1][0])\nprint("ab".join("xyz"))\nprint(" ".join("hello"))`);
add(`print("a\\tb".split("\\t"), "line1\\nline2".splitlines(), "x".splitlines(), "".splitlines())\nprint("a b".split(" "), "a  b".split(" "))`);

// ---------- f-strings ----------
add(`x = 3.14159\nn = 42\nname = "Zed"\nprint(f"{x:.2f} {n:5d}|{n:<5}|{n:^7}|{n:05d} {name:>6}|")\nprint(f"{n:,} {1234567:,} {1234567.891:,.2f} {0.256:.1%} {n:+d} {n:x} {n:b} {n:o} {n:X}")`);
add(`a = 5\nb = 7\nprint(f"{a} + {b} = {a + b}")\nprint(f"{a * b = }")\nprint(f"{a!r} {name!r}" if False else "skip")\nprint(f"{{literal}} {a}")\nprint(f"{'nested'} {'x' * 3}")`);
add(`items = ["a", "b"]\nd = {"k": 1}\nprint(f"{items} {d} {items[0]} {d['k']} {len(items)}")\nprint(f"{3 > 2} {None} {1.0} {2 / 3}")\nprint(f"{'yes' if 3 > 2 else 'no'}")`);
add(`w = 8\np = 3\nv = 3.14159265\nprint(f"{v:{w}.{p}f}|")\nprint(f"{v:10.4f}|{v:<10.2f}|{v:^10.1f}|{-v:10.2f}|{v:+.1f}")\nprint(f"{12:>{w}}|{'ab':*^{w}}|{'ab':-<{w}}|")`);
add(`print(f"{1e-5} {1.5e20} {1e16} {123456789.123456789} {0.1 + 0.2}")\nprint(f"{5:.2f} {5.0:.0f} {2.5:.0f} {3.5:.0f} {0.125:.2f} {0.375:.2f} {1.005:.2f}")\nprint(f"{1234.5678:e} {0.00012345:.2e}")`);
add(`print(f"{'left':<10}|{'right':>10}|{'mid':^10}|")\nprint(f"{'x':5}|{7:5}|{'long text here':5}|{3.5:5}|{True:5}|")`);

// ---------- if / elif / else ----------
add(`for n in [-5, 0, 7]:\n    if n > 0:\n        print(n, "positive")\n    elif n == 0:\n        print(n, "zero")\n    else:\n        print(n, "negative")`);
add(`x = 15\nif x % 3 == 0 and x % 5 == 0:\n    print("FizzBuzz")\nelif x % 3 == 0:\n    print("Fizz")\nelif x % 5 == 0:\n    print("Buzz")\nelse:\n    print(x)`);
add(`for i in range(1, 16):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)`);
add(`age = int(input())\nif age < 3:\n    print("baby")\nelif age < 13:\n    print("child")\nelif age < 20:\n    print("teen")\nelse:\n    print("adult")`, '15');
add(`a = int(input())\nb = int(input())\nif a > b:\n    print(a, "is larger")\nelif a < b:\n    print(b, "is larger")\nelse:\n    print("equal")`, '4\n9');
add(`x = 7\nprint("odd" if x % 2 else "even")\nprint("big" if x > 5 else "small")\ny = x if x > 10 else -x\nprint(y)`);
add(`score = 85\nif score >= 90: print("A")\nelif score >= 80: print("B")\nelse: print("C")`);
add(`x = 5\nif x > 3:\n    if x > 4:\n        print("a")\n    else:\n        print("b")\nelse:\n    print("c")\nprint("done")`);
add(`def grade(s):\n    if s >= 90:\n        return "A"\n    elif s >= 80:\n        return "B"\n    elif s >= 60:\n        return "C"\n    return "F"\nfor s in [95, 85, 65, 10, 90, 80, 60, 59]:\n    print(s, grade(s))`);
add(`print(bool(0), bool(1), bool(""), bool("a"), bool([]), bool([0]), bool(None), bool(0.0), bool({}), bool(()))\nprint(None is None, 5 is not None, None == 0)`);
add(`a = 0\nb = "text"\nprint(a or b, a and b, b or a, b and a, "" or "default", None or 0 or "x")\nprint(1 and 2 and 3, 1 and 0 and 3)`);
add(`year = int(input())\nif (year % 4 == 0 and year % 100 != 0) or year % 400 == 0:\n    print(year, "leap")\nelse:\n    print(year, "common")`, '2100');
add(`x = 10\ny = 20\nprint(x < y, x > y, x <= 10, x >= 11, x == 10, x != 10)\nprint(1 < x < 100, 1 < x < 5, "a" < "b" < "c")`);

// ---------- while / for / break / continue ----------
add(`i = 1\nwhile i <= 5:\n    print(i)\n    i += 1\nprint("end", i)`);
add(`total = 0\nn = 1\nwhile n <= 100:\n    total += n\n    n += 1\nprint(total)`);
add(`n = 27\nsteps = 0\nwhile n != 1:\n    if n % 2 == 0:\n        n //= 2\n    else:\n        n = 3 * n + 1\n    steps += 1\nprint(steps)`);
add(`for i in range(5):\n    print(i, end=" ")\nprint()\nfor i in range(2, 10, 3):\n    print(i, end=" ")\nprint()\nfor i in range(10, 0, -3):\n    print(i, end=" ")\nprint()\nfor i in range(0):\n    print("never")\nprint(list(range(5)), list(range(1, 4)), list(range(5, 0, -2)), len(range(10)))`);
add(`for i in range(1, 4):\n    for j in range(1, 4):\n        print(i * j, end="\\t")\n    print()`);
add(`for i in range(1, 6):\n    print("*" * i)\nfor i in range(4, 0, -1):\n    print(" " * (4 - i) + "*" * (2 * i - 1))`);
add(`for i in range(10):\n    if i == 3:\n        continue\n    if i == 7:\n        break\n    print(i)\nprint("after")`);
add(`n = 0\nwhile True:\n    n += 1\n    if n * n > 200:\n        break\nprint(n)`);
add(`count = 0\nfor a in range(1, 20):\n    for b in range(a, 20):\n        c2 = a * a + b * b\n        c = int(c2 ** 0.5)\n        if c * c == c2 and c < 20:\n            print(a, b, c)\n            count += 1\nprint(count)`);
add(`words = ["apple", "kiwi", "fig"]\nfor w in words:\n    print(w, len(w))\nfor i, w in enumerate(words):\n    print(i, w)\nfor i, w in enumerate(words, 1):\n    print(i, w)\nfor a, b in zip(words, [1, 2, 3]):\n    print(a, b)`);
add(`total = 0\nfor x in [3, 1, 4, 1, 5, 9, 2, 6]:\n    if x % 2 == 0:\n        continue\n    total += x\nprint(total)`);
add(`i = 10\nwhile i > 0:\n    i -= 3\n    print(i)\nelse_done = True\nprint(else_done)`);
add(`for c in "abc":\n    for d in "12":\n        print(c + d, end=" ")\nprint()`);
add(`k = 0\nfor i in range(3):\n    k += i\nprint(i, k)\nfor j in range(0):\n    pass\ntry_j = 5\nprint(try_j)`);
add(`n = int(input())\nfor i in range(n):\n    print(i * i)`, '5');
add(`nums = []\nwhile True:\n    s = input()\n    if s == "0":\n        break\n    nums.append(int(s))\nprint(nums, sum(nums), max(nums))`, '3\n9\n2\n0\n');
add(`a, b = 0, 1\nfor _ in range(10):\n    print(a, end=" ")\n    a, b = b, a + b\nprint()`);
add(`x = 100\nwhile x > 1:\n    x = x / 2\n    print(x)`);

// ---------- lists ----------
add(`a = [3, 1, 4, 1, 5, 9, 2, 6]\nprint(a, len(a), a[0], a[-1], a[2:5], a[::2], a[::-1])\nprint(sorted(a), sorted(a, reverse=True), a)\nprint(min(a), max(a), sum(a), a.count(1), a.index(4))`);
add(`a = [1, 2, 3]\na.append(4)\na.insert(0, 0)\na.insert(2, 99)\na.insert(100, 7)\nprint(a)\nprint(a.pop(), a.pop(0), a)\na.remove(99)\nprint(a)\na.extend([8, 9])\nprint(a)\na.reverse()\nprint(a)\na.sort()\nprint(a)`);
add(`a = [5, 2, 8]\nb = a\nb.append(1)\nprint(a)\nc = a.copy()\nc.append(2)\nprint(a, c)\nd = a[:]\nd.clear()\nprint(a, d)\nprint(a == [5, 2, 8, 1], a is b, a is not c)`);
add(`a = [1, 2, 3] + [4]\nprint(a, [0] * 3, [[0] * 2] * 2)\nm = [[0] * 3 for _ in range(2)]\nm[0][1] = 5\nprint(m)\ng = [[1, 2], [3, 4]]\nprint(g[1][0], g[0][-1], len(g), sum(g[0]))`);
add(`names = ["Zoe", "adam", "Bob"]\nprint(sorted(names))\nprint(sorted(names, key=str.lower) if False else sorted(names, key=lambda s: s.lower()))\nprint(sorted(names, key=len))\nprint(sorted(names, key=len, reverse=True))\nprint(max(names, key=len), min(names, key=lambda s: s[-1]))`);
add(`pairs = [("a", 3), ("b", 1), ("c", 2), ("d", 1)]\nprint(sorted(pairs, key=lambda p: p[1]))\nprint(sorted(pairs, key=lambda p: p[1], reverse=True))\nprint(sorted(pairs, key=lambda p: (p[1], p[0])))\nprint(max(pairs, key=lambda p: p[1]))`);
add(`a = [1, 2, 3, 4, 5, 6]\nevens = [x for x in a if x % 2 == 0]\nsq = [x * x for x in a]\nprint(evens, sq, [x + 1 for x in range(3)], [c.upper() for c in "abc"])\nprint([(x, y) for x in range(2) for y in range(2)])\nprint([x for x in range(10) if x % 2 == 0 if x > 2])`);
add(`a = [4, 8, 15, 16, 23, 42]\nprint(15 in a, 5 in a, 5 not in a)\nfor i in range(len(a) - 1, -1, -1):\n    print(a[i], end=" ")\nprint()\nprint(a[len(a) // 2], a[-2])`);
add(`a = [3, 1, 2]\nb = sorted(a)\nprint(a, b)\na.sort(reverse=True)\nprint(a)\nprint(list(reversed(a)), list("abc"), list(range(3)), list((1, 2)))`);
add(`def maxof(xs):\n    best = xs[0]\n    for x in xs:\n        if x > best:\n            best = x\n    return best\nprint(maxof([3, 9, 2]), maxof([-5, -2, -9]), maxof([7]))`);
add(`nums = [int(x) for x in input().split()]\nprint(nums)\nprint(sum(nums) / len(nums))\nprint(sorted(nums)[len(nums) // 2])`, '5 3 9 1 7');
add(`a = [1, 2, 3, 4, 5]\nb = a[1:4]\nb[0] = 99\nprint(a, b)\na[0] = -1\na[-1] = -5\nprint(a)\ndel a[1]\nprint(a)\ndel a[-1]\nprint(a)`);
add(`stack = []\nfor x in [1, 2, 3]:\n    stack.append(x)\nwhile stack:\n    print(stack.pop())\nq = [1, 2, 3]\nwhile len(q) > 0:\n    print(q.pop(0), end=" ")\nprint()`);
add(`t = (1, 2, 3)\nprint(t, t[0], t[-1], len(t), t + (4,), t * 2, (1,), ())\na, b, c = t\nprint(a, b, c)\nprint(t.index(2), t.count(1), 2 in t, t[1:])\nprint((1, 2) < (1, 3), (1, 2) == (1, 2), [1, 2] < [1, 3], [1, 2] < [1, 2, 0])`);
add(`print([1, [2, 3], "x", None, True, 2.5, (1, 2)])\nprint([[]], [], [()], ["a'b"], ['a"b'])`);
add(`matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]\nfor row in matrix:\n    print(row)\nprint([row[1] for row in matrix])\nprint([matrix[i][i] for i in range(3)])\nprint(sum(sum(r) for r in matrix))\nprint([[r[i] for r in matrix] for i in range(3)])`);
add(`a = [5, 3, 8, 1]\nfor i in range(len(a)):\n    for j in range(len(a) - 1 - i):\n        if a[j] > a[j + 1]:\n            a[j], a[j + 1] = a[j + 1], a[j]\nprint(a)`);
add(`a = list(range(1, 11))\nprint(sum(a) / len(a), a[:3] + a[-3:], any(x > 9 for x in a), all(x > 0 for x in a), any([]), all([]))\nprint(list(map(lambda x: x * 2, a[:4])), list(filter(lambda x: x % 3 == 0, a)))`);
add(`print(max([1, 5, 3], default=0), max([], default=0), min(5, 9, key=lambda x: -x))\nprint(sorted("hello"), sorted("hello", reverse=True), sorted({3, 1, 2}), sorted([3.5, 1, 2.25]))`);

// ---------- dicts, sets ----------
add(`d = {"a": 1, "b": 2}\nd["c"] = 3\nd["a"] = 10\nprint(d, len(d), d["b"], d.get("z"), d.get("z", 0), "a" in d, "z" in d, "z" not in d)\nprint(list(d), list(d.keys()), list(d.values()), list(d.items()))`);
add(`d = {}\nfor w in "the cat and the hat and the bat".split():\n    d[w] = d.get(w, 0) + 1\nprint(d)\nfor k in d:\n    print(k, d[k])\nfor k, v in d.items():\n    print(k, v)\nprint(sorted(d.items(), key=lambda kv: (-kv[1], kv[0])))\nprint(max(d, key=d.get) if False else max(d.items(), key=lambda kv: kv[1]))`);
add(`d = {1: "one", 2: "two", 2.5: "x", "k": [1, 2], (1, 2): "tuple", True: "t"}\nprint(d)\nprint(d[1], d[(1, 2)], d[2.5], d[1.0])`);
add(`d = {"x": 1}\nprint(d.pop("x"), d, d.pop("y", "none"))\nd.update({"p": 1, "q": 2})\nprint(d, d.setdefault("p", 5), d.setdefault("r", 7), d)\ndel d["p"]\nprint(d)\nc = d.copy()\nc["z"] = 0\nprint(d, c)\nd.clear()\nprint(d, {})`);
add(`scores = {"Ann": [90, 80], "Bo": [70]}\nscores["Bo"].append(100)\nfor name in sorted(scores):\n    print(name, sum(scores[name]) / len(scores[name]))\nprint({k: len(v) for k, v in scores.items()})\nprint({x: x * x for x in range(4)})`);
add(`inv = {"apple": 3, "pear": 0}\nif inv["apple"] > 0:\n    inv["apple"] -= 1\nprint(inv)\nkeys = list(inv.keys())\nkeys.sort()\nprint(keys)\nprint(len(inv), sum(inv.values()), list(inv.values()))`);
add(`s = {1, 2, 3}\ns.add(4)\ns.add(2)\ns.discard(1)\ns.discard(99)\nprint(sorted(s), len(s), 3 in s, 1 in s)\nprint(sorted(set([3, 1, 3, 2, 1])), len(set("hello")), sorted(set("hello")))\nprint(sorted({1, 2, 3}.union({3, 4})), sorted({1, 2, 3}.intersection({2, 3, 4})), sorted({1, 2, 3}.difference({2})))`);
add(`print(set(), {1} == {1}, {1, 2} == {2, 1}, len({1, 1.0, True}), sorted({"b", "a"}))\nu = []\nfor x in [3, 1, 3, 2, 1]:\n    if x not in u:\n        u.append(x)\nprint(u)`);
add(`d = dict()\nd["a"] = 1\nprint(d, dict(a=1, b=2), dict([("x", 1), ("y", 2)]), len(dict()))\nfor i, (k, v) in enumerate({"p": 1, "q": 2}.items()) if False else []:\n    pass\nprint("ok")`);
add(`text = "a b a c b a"\ncounts = {}\nfor w in text.split():\n    if w in counts:\n        counts[w] += 1\n    else:\n        counts[w] = 1\nbest = None\nfor w in counts:\n    if best is None or counts[w] > counts[best]:\n        best = w\nprint(best, counts[best], counts)`);

// ---------- functions ----------
add(`def add(a, b):\n    return a + b\nprint(add(2, 3), add("x", "y"), add([1], [2]), add(1.5, 2))`);
add(`def greet(name, punct="!"):\n    print("Hello, " + name + punct)\ngreet("A")\ngreet("B", "?")\ngreet(punct=".", name="C")\nprint(greet("D"))`);
add(`def f(n):\n    if n <= 1:\n        return 1\n    return n * f(n - 1)\nprint(f(1), f(5), f(10), f(20), f(25))`);
add(`def fib(n):\n    if n < 2:\n        return n\n    return fib(n - 1) + fib(n - 2)\nprint([fib(i) for i in range(15)])`);
add(`def power(b, e):\n    if e == 0:\n        return 1\n    return b * power(b, e - 1)\nprint(power(2, 10), power(3, 0), power(5, 3))`);
add(`def gcd(a, b):\n    while b != 0:\n        a, b = b, a % b\n    return a\nprint(gcd(12, 18), gcd(17, 5), gcd(100, 75), gcd(0, 5))`);
add(`def is_prime(n):\n    if n < 2:\n        return False\n    for i in range(2, int(n ** 0.5) + 1):\n        if n % i == 0:\n            return False\n    return True\nprint([n for n in range(50) if is_prime(n)])`);
add(`def minmax(xs):\n    return min(xs), max(xs)\nlo, hi = minmax([4, 2, 9])\nprint(lo, hi, minmax([1]))\nr = minmax([3, 1])\nprint(r, r[0], type(r) == tuple)`);
add(`count = 0\ndef bump():\n    global count\n    count += 1\nbump()\nbump()\nprint(count)\ndef noglobal():\n    count = 100\n    return count\nprint(noglobal(), count)`);
add(`x = 10\ndef show():\n    print(x)\nshow()\nx = 20\nshow()\ndef shadow(x):\n    x = x + 1\n    return x\nprint(shadow(5), x)`);
add(`def total(xs):\n    t = 0\n    for x in xs:\n        t += x\n    return t\ndef average(xs):\n    return total(xs) / len(xs)\nprint(total([1, 2, 3]), average([1, 2, 3, 4]))`);
add(`def nothing():\n    pass\nprint(nothing())\ndef early(n):\n    if n < 0:\n        return "neg"\n    print("not negative")\nprint(early(-1), early(1))`);
add(`def apply(f, x):\n    return f(x)\ndef double(n):\n    return n * 2\nprint(apply(double, 4), apply(lambda v: v + 1, 4), apply(abs, -3), apply(str, 7), apply(len, "abc"))\nsq = lambda x: x * x\nprint(sq(9), (lambda a, b: a * b)(3, 4))`);
add(`def counter_to(n):\n    for i in range(1, n + 1):\n        print(i, end=" ")\n    print()\ncounter_to(5)\ncounter_to(0)\ndef rev(s):\n    out = ""\n    for ch in s:\n        out = ch + out\n    return out\nprint(rev("hello"), rev(""))`);
add(`def collatz(n):\n    steps = 0\n    while n != 1:\n        n = n // 2 if n % 2 == 0 else 3 * n + 1\n        steps += 1\n    return steps\nprint([collatz(k) for k in range(1, 11)])`);
add(`def sum_to(n):\n    if n == 0:\n        return 0\n    return n + sum_to(n - 1)\nprint(sum_to(10), sum_to(100))\ndef digits(n):\n    if n < 10:\n        return n\n    return n % 10 + digits(n // 10)\nprint(digits(12345), digits(9))`);
add(`def hanoi(n, a, b, c):\n    if n == 0:\n        return 0\n    return hanoi(n - 1, a, c, b) + 1 + hanoi(n - 1, c, b, a)\nprint(hanoi(1, "A", "B", "C"), hanoi(5, "A", "B", "C"), hanoi(10, "A", "B", "C"))`);
add(`def bsearch(xs, t):\n    lo, hi = 0, len(xs) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if xs[mid] == t:\n            return mid\n        elif xs[mid] < t:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\nxs = [1, 3, 5, 7, 9, 11]\nprint([bsearch(xs, t) for t in [1, 11, 7, 4, 0, 12]])`);
add(`def make_adder(n):\n    def add(x):\n        return x + n\n    return add\na5 = make_adder(5)\nprint(a5(1), make_adder(10)(1))\ndef outer():\n    v = 1\n    def inner():\n        return v + 1\n    return inner()\nprint(outer())`);
add(`def f(a, b=2, c=3):\n    return a * 100 + b * 10 + c\nprint(f(1), f(1, 5), f(1, 5, 7), f(1, c=9), f(c=1, a=2))\ndef g(items=None):\n    return items\nprint(g(), g([1]))`);
add(`def is_pal(s):\n    s = s.lower()\n    t = "".join(c for c in s if c.isalnum())\n    return t == t[::-1]\nprint(is_pal("A man, a plan, a canal: Panama"), is_pal("hello"), is_pal(""))`);
add(`def caesar(text, k):\n    out = ""\n    for c in text:\n        if c.isalpha():\n            base = ord("A") if c.isupper() else ord("a")\n            out += chr((ord(c) - base + k) % 26 + base)\n        else:\n            out += c\n    return out\nprint(caesar("Hello, World!", 3), caesar(caesar("abc xyz", 5), -5), caesar("xyz", 3))`);
add(`def anagram(a, b):\n    return sorted(a.replace(" ", "").lower()) == sorted(b.replace(" ", "").lower())\nprint(anagram("Listen", "Silent"), anagram("abc", "abd"), anagram("dormitory", "dirty room"))`);
add(`def wc(s):\n    d = {}\n    for w in s.lower().split():\n        w = w.strip(".,!?")\n        d[w] = d.get(w, 0) + 1\n    return d\nr = wc("It is what it is. Is it?")\nprint(r)\nprint(sorted(r.items(), key=lambda p: (-p[1], p[0])))`);
add(`def merge(a, b):\n    out = []\n    i = j = 0\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            out.append(a[i]); i += 1\n        else:\n            out.append(b[j]); j += 1\n    return out + a[i:] + b[j:]\nprint(merge([1, 4, 9], [2, 3, 10, 11]))`);
add(`def msort(xs):\n    if len(xs) <= 1:\n        return xs\n    m = len(xs) // 2\n    a, b = msort(xs[:m]), msort(xs[m:])\n    out = []\n    while a and b:\n        out.append(a.pop(0) if a[0] <= b[0] else b.pop(0))\n    return out + a + b\nprint(msort([5, 2, 9, 1, 5, 6, 0, -3]))`);
add(`def flatten(xs):\n    out = []\n    for x in xs:\n        if isinstance(x, list):\n            out.extend(flatten(x))\n        else:\n            out.append(x)\n    return out\nprint(flatten([1, [2, [3, [4]], 5], [], 6]))`);
add(`def to_binary(n):\n    if n == 0:\n        return "0"\n    s = ""\n    while n > 0:\n        s = str(n % 2) + s\n        n //= 2\n    return s\nprint([to_binary(k) for k in [0, 1, 2, 5, 10, 255]], int(to_binary(37), 2))`);
add(`def pascal(n):\n    row = [1]\n    for _ in range(n):\n        print(row)\n        row = [1] + [row[i] + row[i + 1] for i in range(len(row) - 1)] + [1]\npascal(6)`);
add(`def perfect(n):\n    return n == sum(d for d in range(1, n) if n % d == 0)\nprint([n for n in range(2, 500) if perfect(n)])\nprint(sum(1 for n in range(1, 100) if n % 7 == 0))`);

// ---------- input handling ----------
add(`name = input("Name? ")\nprint("Hi,", name)\nn = int(input("Number: "))\nprint(n * 2)`, 'Bo\n21');
add(`a = float(input())\nb = float(input())\nprint(a + b)\nprint(round(a / b, 3))\nprint(f"{a * b:.2f}")`, '3\n4.5');
add(`line = input()\nprint(line.upper(), len(line), line.split())\nprint(line[::-1])`, 'Hello Big World');
add(`n = int(input())\ntotal = 0\nfor _ in range(n):\n    total += int(input())\nprint("sum =", total)\nprint("avg =", total / n)`, '3\n10\n20\n35');
add(`words = input().split()\nprint(len(words))\nprint(max(words, key=len))\nprint(" ".join(w.capitalize() for w in words))\nprint(sorted(words))`, 'the quick brown fox jumps');
add(`x, y = map(int, input().split())\nprint(x + y, x * y)\nnums = list(map(int, input().split()))\nprint(sum(nums), max(nums))`, '3 4\n5 1 7 2');
add(`s = input()\nprint(s.strip() == "")\nprint(len(s))\nt = input()\nprint(repr(t))`, '   \n  x y  ');
add(`import math\nr = float(input())\nprint(round(math.pi * r ** 2, 2), math.sqrt(16), math.floor(2.7), math.ceil(2.1), math.floor(-2.1), math.ceil(-2.1), math.gcd(12, 18), math.factorial(6), math.isqrt(99), math.hypot(3, 4))`, '2');
add(`import math\nprint(math.sqrt(2), math.pi, math.e, math.pow(2, 0.5), math.fabs(-3), math.log(math.e), math.log10(1000), math.log2(8), round(math.sin(math.pi / 6), 6), math.cos(0), math.radians(180), math.degrees(math.pi))\nprint(math.floor(5), math.ceil(5), math.trunc(-2.7), math.lcm(4, 6) if hasattr(math, "lcm") else 12)`.replace(' if hasattr(math, "lcm") else 12', ''));

// ---------- random (the same numbers as CPython after seed) ----------
add(`import random\nrandom.seed(42)\nprint(random.randint(1, 100), random.randint(1, 100), random.randint(1, 6))\nprint(random.random())\nprint(random.randrange(10), random.randrange(5, 50, 5), random.randrange(100))`);
add(`import random\nrandom.seed(1)\nxs = [1, 2, 3, 4, 5, 6, 7, 8]\nrandom.shuffle(xs)\nprint(xs)\nprint(random.choice(xs), random.choice("abcdef"), random.choice(["x", "y", "z"]))\nprint(random.uniform(1, 2))`);
add(`import random\nrandom.seed(2024)\nprint([random.randint(0, 9) for _ in range(12)])\nrandom.seed(2024)\nprint([random.randint(0, 9) for _ in range(12)])\nrandom.seed(7)\nprint(random.sample(range(100), 5), random.sample(["a", "b", "c", "d"], 2))`);
add(`import random\nrandom.seed(0)\nprint(random.random(), random.random())\nrandom.seed(123456789012345678901234567890)\nprint(random.randint(1, 10**12), random.randint(-5, 5))\nrandom.seed(-5)\nprint(random.randint(1, 1000))`);
add(`from random import randint, seed\nseed(99)\nprint(randint(1, 10), randint(1, 10), randint(1, 10))\nsecret = randint(1, 100)\nguesses = 0\nlo, hi = 1, 100\nwhile True:\n    guess = (lo + hi) // 2\n    guesses += 1\n    if guess == secret:\n        break\n    elif guess < secret:\n        lo = guess + 1\n    else:\n        hi = guess - 1\nprint(secret, guesses)`);
add(`import random as rnd\nrnd.seed(5)\nprint(rnd.randint(1, 6), rnd.choice([10, 20, 30]))\nfor _ in range(3):\n    print(rnd.random() < 0.5, end=" ")\nprint()`);

// ---------- scope, misc statements ----------
add(`import math\nprint(math.pi)\nfrom math import sqrt, floor\nprint(sqrt(49), floor(9.9))\nimport math as m\nprint(m.ceil(0.1))`);
add(`x = 5\nassert x == 5\nprint("assert ok")\npass\nif True:\n    pass\nprint(None)\nprint(True, False)`);
add(`def f():\n    return 1\n\n\n# a comment\nx = f()  # trailing comment\nprint(x)  \n\n\nprint("# not a comment")`);
add(`x = (1 +\n     2 +\n     3)\nprint(x)\nl = [1,\n     2,\n     3]\nprint(l)\nd = {\n    "a": 1,\n    "b": 2,\n}\nprint(d)\nprint(1 + \\\n      2)`);
add(`x = 3\nif x > 1: print("one-line if")\nwhile x > 0: x -= 1\nprint(x)\nfor i in range(2): print(i)`);
add(`a = [1, 2, 3]\nb = [i * 2 for i in a]\nc = {i: i ** 2 for i in a}\nd = {i % 2 for i in range(6)}\nprint(b, c, sorted(d), [[i, j] for i in a for j in a if i < j])\nprint(sum(x for x in a), max(x * 2 for x in a), sorted((x for x in [3, 1, 2]), reverse=True))`);
add(`i = 0\ndata = []\nwhile i < 5:\n    i += 1\n    if i == 2:\n        continue\n    if i == 5:\n        break\n    data.append(i)\nprint(data, i)`);
add(`def a():\n    return b()\ndef b():\n    return "b called"\nprint(a())\nresult = [a(), b()]\nprint(result)`);
add(`n = 5\nresult = 1\nwhile n > 1:\n    result *= n\n    n -= 1\nprint(result)\nprint(f"{result} factorial-ish")`);
add(`temps = [22.5, 19.0, 24.8, 21.3]\nprint(sum(temps) / len(temps))\nprint(round(sum(temps) / len(temps), 1))\nprint(max(temps), min(temps), sorted(temps))\nprint([round(t * 9 / 5 + 32, 1) for t in temps])`);
add(`price = 19.99\nqty = 3\ntotal = price * qty\nprint(total)\nprint(round(total, 2))\nprint(f"{total:.2f}")\nprint(f"{total * 1.08:.2f}")\nprint(price * 100, int(price * 100))`);
add(`balance = 100\nfor amount in [-30, 50, -200, 25]:\n    if balance + amount < 0:\n        print("insufficient", balance)\n    else:\n        balance += amount\n        print("ok", balance)`);
add(`todo = []\ntodo.append("write")\ntodo.append("test")\ntodo.append("ship")\ntodo.remove("test")\nfor i, t in enumerate(todo, 1):\n    print(f"{i}. {t}")\nprint(len(todo), "left")`);
add(`def rps(a, b):\n    if a == b:\n        return "draw"\n    wins = {("rock", "scissors"), ("scissors", "paper"), ("paper", "rock")}\n    return "first" if (a, b) in wins else "second"\nfor a, b in [("rock", "paper"), ("rock", "rock"), ("paper", "rock")]:\n    print(a, b, rps(a, b))`);
add(`grades = {"math": 90, "art": 75, "pe": 88}\navg = sum(grades.values()) / len(grades)\nprint(round(avg, 2))\nbest = max(grades, key=lambda k: grades[k])\nprint(best, grades[best])\nfor k in sorted(grades, key=lambda k: -grades[k]):\n    print(k, grades[k])`);
add(`room = "hall"\nrooms = {"hall": {"north": "kitchen"}, "kitchen": {"south": "hall"}}\nmoves = ["north", "south", "west"]\nfor m in moves:\n    nxt = rooms[room].get(m)\n    if nxt:\n        room = nxt\n        print("you go", m, "to the", room)\n    else:\n        print("you cannot go", m)`);
add(`board = [" "] * 9\nboard[4] = "X"\nboard[0] = "O"\nfor r in range(3):\n    print("|".join(board[r * 3:r * 3 + 3]))\nprint(board.count(" "))`);
add(`x = 0.1\nsm = 0\nfor _ in range(10):\n    sm += x\nprint(sm, sm == 1.0, abs(sm - 1.0) < 1e-9)\nprint(0.1 + 0.2 == 0.3, round(0.1 + 0.2, 10) == 0.3)`);
add(`print(1 if None else 2, [] or "empty", "x" if [0] else "y")\nprint(len("hello") > 3 and "long" or "short")\nprint(not [], not [1])`);
add(`s = "hello"\nprint(s.upper().lower().capitalize().swapcase())\nprint("a-b-c".split("-")[1].upper())\nprint(len(s.replace("l", "")))\nprint(s[0].upper() + s[1:])\nprint(s * 2 + "!" * 3)`);
add(`import math\nfor n in [1, 4, 10, 16, 99, 100]:\n    r = math.isqrt(n)\n    print(n, r, r * r == n, round(math.sqrt(n), 3))`);
add(`print(3 // 2 + 3 % 2 * 2 ** 2 - 1)\nprint(((((2)))))\nprint(2 * (3 + 4) ** 2 // 5 % 7)\nprint(-2 ** 2 + 3 * -1)\nprint(10 - 2 - 3 - 1)\nprint(2 ** 2 ** 3)\nprint(100 / 10 / 5)\nprint(7 - -3, 7 + +3, 7 * -3)`);

// ---------- star arguments, exit, time ----------
add(`xs = [3, 1, 2]\nprint(*xs)\nprint(*xs, sep=", ")\nprint(*"abc")\nprint(max(*xs), sum(xs))`);
add(`def total(*nums):\n    s = 0\n    for n in nums:\n        s += n\n    return s\nprint(total(), total(1), total(1, 2, 3), total(*[4, 5]))\ndef f(a, *rest):\n    return (a, rest, len(rest))\nprint(f(1), f(1, 2, 3))`);
add(`print("before")\nfor i in range(5):\n    if i == 2:\n        exit()\n    print(i)\nprint("never")`);
add(`import time\ntime.sleep(0.5)\nt = time.time()\nprint(t > 0)\nimport sys\nprint("a")\nsys.exit()\nprint("b")`);

// ---------- GENERATED: random expression programs (seeded, so every run is the same) ----------
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry(86);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const GEN = [];
function intExpr(d) {
  if (d <= 0 || rnd() < 0.25) return String(pick([ri(-20, 20), ri(0, 9), ri(1, 100), 0, 1]));
  const a = intExpr(d - 1), b = intExpr(d - 1);
  const op = pick(['+', '-', '*', '//', '%', '+', '-', '*']);
  if (op === '//' || op === '%') return `(${a}) ${op} (${ri(1, 9) * pick([1, -1])})`;
  return `(${a}) ${op} (${b})`;
}
function floatExpr(d) {
  if (d <= 0 || rnd() < 0.3) return pick([`${ri(0, 99) / 10}`, `${ri(1, 999) / 100}`, `${ri(1, 9)}.5`, `${ri(1, 9)}e-${ri(1, 6)}`, `${ri(1, 9)}.25`, `${ri(-9, 9)}.0`, `${ri(1, 99999) / 1000}`]);
  const op = pick(['+', '-', '*', '/', '+', '*']);
  if (op === '/') return `(${floatExpr(d - 1)}) / (${ri(1, 9)} + ${ri(1, 9) / 10})`;
  return `(${floatExpr(d - 1)}) ${op} (${rnd() < 0.5 ? intExpr(1) : floatExpr(d - 1)})`;
}
const WORDS = ['apple', 'Banana', 'cherry pie', ' spaced ', 'Hello, World', 'a1b2c3', 'x', 'MiXeD CaSe', 'quick brown fox', 'abcabcabc', '123', 'tab separated'];
function strExpr(d) {
  const w = JSON.stringify(pick(WORDS));
  if (d <= 0) return w;
  const s = strExpr(d - 1);
  switch (ri(0, 11)) {
    case 0: return `${s}.upper()`; case 1: return `${s}.lower()`; case 2: return `${s}.strip()`; case 3: return `${s}.title()`;
    case 4: return `${s}[${ri(-4, 4)}:${ri(-4, 8)}]`; case 5: return `${s}[::${pick([-1, 2, -2, 3])}]`; case 6: return `(${s} + ${w})`;
    case 7: return `${s}.replace(${JSON.stringify(pick(['a', 'l', ' ', 'o', 'c']))}, ${JSON.stringify(pick(['', '#', 'XY']))})`;
    case 8: return `(${s} * ${ri(0, 3)})`; case 9: return `${s}.capitalize()`; case 10: return `${s}.swapcase()`; default: return `"-".join(${s}.split())`;
  }
}
function listExpr() {
  const xs = `[${Array.from({ length: ri(0, 8) }, () => ri(-9, 20)).join(', ')}]`;
  return pick([`sorted(${xs})`, `sorted(${xs}, reverse=True)`, `${xs}[${ri(-3, 3)}:${ri(-3, 6)}]`, `${xs}[::${pick([-1, 2, 3, -2])}]`, `[x * x for x in ${xs}]`, `[x for x in ${xs} if x % 2 == 0]`, `sum(${xs})`, `len(${xs})`, `list(reversed(${xs}))`, `${xs} + ${xs}`, `[x // 3 for x in ${xs}]`, `[x % 4 for x in ${xs}]`, `sorted(set(${xs}))`, `[${xs}.count(${ri(-2, 5)}), ${xs}.count(0)]`]);
}
for (let i = 0; i < 90; i++) GEN.push({ src: `print(${intExpr(3)})` });
for (let i = 0; i < 80; i++) GEN.push({ src: `print(${floatExpr(2)})` });
for (let i = 0; i < 60; i++) GEN.push({ src: `print(${strExpr(2)})` });
for (let i = 0; i < 40; i++) GEN.push({ src: `print(${listExpr()})` });
for (let i = 0; i < 40; i++) {
  const x = rnd() * pick([1, 10, 1000, 0.01, 1e6]) * pick([1, -1]);
  const spec = pick(['.0f', '.1f', '.2f', '.3f', '10.2f', '<10.1f', '^12.3f', '+.2f', ',.2f', '.1%', '.2e', '', '>8', '.4g', '08.3f']);
  GEN.push({ src: `x = ${x}\nprint(f"{x:${spec}}", repr(x), str(round(x, ${ri(0, 3)})), int(x))` });
}
for (let i = 0; i < 30; i++) {
  const a = ri(-200, 200), b = pick([ri(1, 30), -ri(1, 30)]);
  GEN.push({ src: `a = ${a}\nb = ${b}\nprint(a // b, a % b, divmod(a, b), a / b, a ** 2 % abs(b), (a + 0.5) // b, (a + 0.5) % b)` });
}
for (let i = 0; i < 20; i++) {
  const n = ri(0, 40);
  GEN.push({ src: `s = 0\nfor i in range(${n}):\n    if i % ${ri(2, 5)} == 0:\n        s += i * ${ri(1, 4)}\n    else:\n        s -= ${ri(0, 3)}\nprint(s)\nprint([i * ${ri(1, 4)} for i in range(${ri(0, 8)})])` });
}

// ---------- BROKEN: one mistake each; the kind and the line of the message (and a word the message / hint must contain) ----------
const BROKEN = [
  // syntax: missing colon, brackets, quotes, indentation
  { src: 'x = 5\nif x > 3\n    print("big")', kind: 'SyntaxError', line: 2, has: '冒号' },
  { src: 'for i in range(3)\n    print(i)', kind: 'SyntaxError', line: 1, has: '冒号' },
  { src: 'while True\n    break', kind: 'SyntaxError', line: 1, has: '冒号' },
  { src: 'def f(x)\n    return x', kind: 'SyntaxError', line: 1, has: '冒号' },
  { src: 'x = 1\nif x == 1:\n    print("a")\nelse\n    print("b")', kind: 'SyntaxError', line: 4, has: '冒号' },
  { src: 'x = 2\nif x = 2:\n    print("two")', kind: 'SyntaxError', line: 2, has: '==' },
  { src: 'print("hi"', kind: 'SyntaxError', line: 1, has: '括号' },
  { src: 'x = (1 + 2\nprint(x)', kind: 'SyntaxError', line: 1, has: '括号' },
  { src: 'xs = [1, 2, 3\nprint(xs)', kind: 'SyntaxError', line: 1, has: '括号' },
  { src: 'print("a"))', kind: 'SyntaxError', line: 1, has: '括号' },
  { src: 'x = [1, 2)', kind: 'SyntaxError', line: 1, has: '括号' },
  { src: 'print("hello)\nprint(1)', kind: 'SyntaxError', line: 1, has: '引号' },
  { src: "s = 'abc\nprint(s)", kind: 'SyntaxError', line: 1, has: '引号' },
  { src: 's = """never closed\nprint(1)', kind: 'SyntaxError', line: 1, has: '引号' },
  { src: 'print "hello"', kind: 'SyntaxError', line: 1, has: '括号' },
  { src: 'print(“你好”)', kind: 'SyntaxError', line: 1, has: '中文标点' },
  { src: 'x = 5：\nprint(x)', kind: 'SyntaxError', line: 1, has: '中文标点' },
  { src: 'if x > 1：\n    pass', kind: 'SyntaxError', line: 1, has: '中文标点' },
  { src: 'print(1，2)', kind: 'SyntaxError', line: 1, has: '中文标点' },
  { src: 'x = 5 +\nprint(x)', kind: 'SyntaxError', line: 1 },
  { src: 'x = 3 4', kind: 'SyntaxError', line: 1 },
  { src: 'x = * 3', kind: 'SyntaxError', line: 1 },
  { src: 'x = 2x + 1', kind: 'SyntaxError', line: 1, has: '乘' },
  { src: 'def f():\nprint(1)', kind: 'IndentationError', line: 1, has: '缩进' },
  { src: 'x = 1\n    y = 2', kind: 'IndentationError', line: 2, has: '缩进' },
  { src: 'if True:\n        a = 1\n    b = 2', kind: 'IndentationError', line: 3, has: '缩进' },
  { src: 'for i in range(2):\n', kind: 'IndentationError', line: 1, has: '缩进' },
  { src: 'else:\n    pass', kind: 'SyntaxError', line: 1, has: 'if' },
  { src: 'x = 1\nelif x:\n    pass', kind: 'SyntaxError', line: 2, has: 'if' },
  { src: 'x = 5 = 6', kind: 'SyntaxError', line: 1 },
  { src: '5 = x', kind: 'SyntaxError', line: 1 },
  { src: 'f() = 3', kind: 'SyntaxError', line: 1 },
  { src: 'x = $5', kind: 'SyntaxError', line: 1 },
  { src: 'class A:\n    pass', kind: 'SyntaxError', line: 1, has: 'class' },
  { src: 'x = [1, 2\ny = 3\nprint(y)', kind: 'SyntaxError', line: 1 },
  { src: 'print(f"{x")', kind: 'SyntaxError', line: 1 },
  { src: 'def 3f():\n    pass', kind: 'SyntaxError', line: 1 },
  { src: 'for in range(3):\n    pass', kind: 'SyntaxError', line: 1 },
  // names
  { src: 'name = "Ann"\nprint(nmae)', kind: 'NameError', line: 2, has: 'name' },
  { src: 'total = 0\nprint(totl)', kind: 'NameError', line: 2, has: 'total' },
  { src: 'prnt("x")', kind: 'NameError', line: 1, has: 'print' },
  { src: 'print(x)', kind: 'NameError', line: 1, has: '没有定义' },
  { src: 'x = true\nprint(x)', kind: 'NameError', line: 1, has: 'True' },
  { src: 'for i in range(3):\n    pass\nprint(j)', kind: 'NameError', line: 3 },
  { src: 'def f():\n    y = 1\nf()\nprint(y)', kind: 'NameError', line: 4 },
  { src: 'def f():\n    print(c)\n    c = 1\nf()', kind: 'UnboundLocalError', line: 2, has: 'global' },
  { src: 'n = 0\ndef inc():\n    n += 1\ninc()', kind: 'UnboundLocalError', line: 3, has: 'global' },
  { src: 'import mathh', kind: 'NameError', line: 1, has: 'math' },
  { src: 'import math\nprint(math.sqroot(4))', kind: 'AttributeError', line: 2, has: 'sqrt' },
  // types
  { src: 'print("age: " + 5)', kind: 'TypeError', line: 1, has: 'str' },
  { src: 'n = input()\nprint(n + 1)', kind: 'TypeError', line: 2, has: 'int' , input: '4' },
  { src: 'x = 3\nprint("a" * "b")', kind: 'TypeError', line: 2 },
  { src: 'n = input()\nif n > 3:\n    print(n)', kind: 'TypeError', line: 2, has: 'int()', input: '5' },
  { src: 'print(len(5))', kind: 'TypeError', line: 1, has: 'len' },
  { src: 'x = 5\nx()', kind: 'TypeError', line: 2 },
  { src: 'for i in 5:\n    pass', kind: 'TypeError', line: 1, has: 'range' },
  { src: 'def f(a, b):\n    return a\nf(1)', kind: 'TypeError', line: 3, has: 'b' },
  { src: 'def f(a):\n    return a\nf(1, 2)', kind: 'TypeError', line: 3 },
  { src: 'def f():\n    pass\nprint(f() + 1)', kind: 'TypeError', line: 3, has: 'return' },
  { src: 's = "abc"\ns[0] = "x"', kind: 'TypeError', line: 2 },
  { src: 'xs = [1, 2]\nprint(xs["a"])', kind: 'TypeError', line: 2 },
  { src: 'print(int([1]))', kind: 'TypeError', line: 1 },
  { src: 'print([1, 2] + 3)', kind: 'TypeError', line: 1 },
  { src: 'print(sorted([1, "a"]))', kind: 'TypeError', line: 1 },
  { src: 'print(abs("x"))', kind: 'TypeError', line: 1 },
  { src: 'print("x".join([1, 2]))', kind: 'TypeError', line: 1, has: 'join' },
  { src: 'd = {[1]: 2}', kind: 'TypeError', line: 1 },
  { src: 'xs = [1]\nxs.push(2)', kind: 'AttributeError', line: 2, has: 'append' },
  { src: 's = "abc"\nprint(s.uper())', kind: 'AttributeError', line: 2, has: 'upper' },
  { src: 'x = 5\nx.append(1)', kind: 'AttributeError', line: 2 },
  // values
  { src: 'print(int("abc"))', kind: 'ValueError', line: 1, has: 'abc' },
  { src: 'n = int(input())', kind: 'ValueError', line: 1, input: 'twelve' },
  { src: 'print(int("3.5"))', kind: 'ValueError', line: 1, has: 'float' },
  { src: 'print(float("x"))', kind: 'ValueError', line: 1 },
  { src: 'a, b = [1, 2, 3]', kind: 'ValueError', line: 1 },
  { src: 'import math\nprint(math.sqrt(-1))', kind: 'ValueError', line: 2 },
  { src: 'xs = [1]\nxs.remove(5)', kind: 'ValueError', line: 2 },
  { src: 'print(range(0, 5, 0))', kind: 'ValueError', line: 1 },
  { src: 'print(max([]))', kind: 'ValueError', line: 1 },
  // arithmetic / ranges / keys
  { src: 'print(10 / 0)', kind: 'ZeroDivisionError', line: 1 },
  { src: 'x = 0\nprint(5 // x)', kind: 'ZeroDivisionError', line: 2 },
  { src: 'def avg(xs):\n    return sum(xs) / len(xs)\nprint(avg([]))', kind: 'ZeroDivisionError', line: 2 },
  { src: 'print(5 % 0)', kind: 'ZeroDivisionError', line: 1 },
  { src: 'xs = [1, 2, 3]\nprint(xs[3])', kind: 'IndexError', line: 2, has: '3' },
  { src: 'xs = []\nprint(xs[0])', kind: 'IndexError', line: 2, has: '空' },
  { src: 'xs = [1, 2, 3]\nfor i in range(4):\n    print(xs[i])', kind: 'IndexError', line: 3 },
  { src: 's = "abc"\nprint(s[10])', kind: 'IndexError', line: 2 },
  { src: 'xs = [1]\nxs.pop(); xs.pop()', kind: 'IndexError', line: 2 },
  { src: 'd = {"a": 1}\nprint(d["b"])', kind: 'KeyError', line: 2, has: 'get' },
  { src: 'd = {}\nd["x"] += 1', kind: 'KeyError', line: 2 },
  { src: 'x = input()', kind: 'EOFError', line: 1, has: '输入' },
  { src: 'a = input()\nb = input()', kind: 'EOFError', line: 2, input: 'one' },
  // limits
  { src: 'while True:\n    pass', kind: 'StepLimit', line: 1 },
  { src: 'x = 0\nwhile x < 10:\n    y = 1', kind: 'StepLimit', line: 2 },
  { src: 'def f():\n    return f()\nf()', kind: 'RecursionError', line: 2 },
  { src: 'def f(n):\n    return f(n + 1) + 1\nprint(f(0))', kind: 'RecursionError', line: 2 },
  { src: 'while True:\n    print("x")', kind: 'OutputLimit', line: 2, budget: 5e6 },
  { src: 'print(2 ** 100000000)', kind: 'OverflowError', line: 1 },
  { src: 'assert 1 == 2', kind: 'AssertionError', line: 1 },
  // blanks of a starter program
  { src: 'total = 0\nfor i in range(5):\n    total = total + ___\nprint(total)', kind: 'BlankError', line: 3, has: '___' },
];

module.exports = { HAND, GEN, BROKEN, PROGRAMS: [...HAND, ...GEN] };
