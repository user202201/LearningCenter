// Builds src/data/chem.json: the junior-high chemistry library (written from memory, to be proofread by a teacher).
// Run: node scripts/make-chem.mjs   (checks every equation for atom balance and every formula for a name before writing)
import fs from "node:fs";
const out = new URL("../src/data/chem.json", import.meta.url).pathname;

// equation | conditions | type | chapter | phenomenon
const RX = `
4P+5O2=2P2O5|点燃|化合|air|红磷在空气中燃烧，产生大量白烟，放出热量。
S+O2=SO2|点燃|化合|air|硫在空气中燃烧发出淡蓝色火焰，在氧气中发出明亮的蓝紫色火焰，生成有刺激性气味的气体。
C+O2=CO2|点燃|化合|air|木炭在氧气中燃烧发出白光，放出热量，生成能使澄清石灰水变浑浊的气体。
2C+O2=2CO|点燃|化合|air|氧气不足时碳不完全燃烧，生成一氧化碳。
3Fe+2O2=Fe3O4|点燃|化合|air|铁丝在氧气中剧烈燃烧，火星四射，生成黑色固体，放出大量的热。
2Mg+O2=2MgO|点燃|化合|air|镁条剧烈燃烧，发出耀眼的白光，生成白色固体。
4Al+3O2=2Al2O3|常温|化合|air|铝在空气中表面生成一层致密的氧化铝薄膜，保护内部的铝。
2Cu+O2=2CuO|加热|化合|air|红色的铜丝加热后表面变黑。
2Hg+O2=2HgO|加热|化合|air|银白色的液态汞加热后变成红色粉末（拉瓦锡测定空气成分）。
2HgO=2Hg+O2↑|加热|分解|air|红色粉末受热变成银白色液体，同时产生能使带火星木条复燃的气体。
2KMnO4=K2MnO4+MnO2+O2↑|加热|分解|air|紫黑色固体受热分解，产生能使带火星木条复燃的气体。
2KClO3=2KCl+3O2↑|催化剂+加热|分解|air|白色固体与二氧化锰混合加热，产生能使带火星木条复燃的气体。
2H2O2=2H2O+O2↑|催化剂|分解|air|过氧化氢溶液中加入二氧化锰，立即产生大量气泡，带火星木条复燃。
2NO+O2=2NO2|常温|化合|air|无色气体遇到氧气变成红棕色气体。
Fe+S=FeS|加热|化合|air|铁粉和硫粉的混合物加热，发出红光，生成黑色固体。
2H2+O2=2H2O|点燃|化合|water|氢气安静燃烧，发出淡蓝色火焰，烧杯内壁出现水雾。
2H2O=2H2↑+O2↑|通电|分解|water|两个电极上都产生气泡，负极与正极气体的体积比约为2比1。
CaO+H2O=Ca(OH)2|常温|化合|water|生石灰遇水剧烈反应，放出大量的热。
Na2O+H2O=2NaOH|常温|化合|water|氧化钠与水反应生成氢氧化钠，放出热量。
CO2+H2O=H2CO3|常温|化合|water|二氧化碳通入紫色石蕊溶液，溶液变红。
H2CO3=H2O+CO2↑|加热|分解|water|变红的石蕊溶液加热后又变回紫色，有气泡产生。
SO2+H2O=H2SO3|常温|化合|water|二氧化硫溶于水生成亚硫酸（酸雨的成因之一）。
SO3+H2O=H2SO4|常温|化合|water|三氧化硫与水反应生成硫酸（酸雨的成因之一）。
CuSO4+5H2O=CuSO4·5H2O|常温|化合|water|白色的无水硫酸铜遇水变蓝（用来检验水）。
CuSO4·5H2O=CuSO4+5H2O|加热|分解|water|蓝色晶体受热失去结晶水，变成白色粉末。
H2+CuO=Cu+H2O|加热|置换|water|黑色粉末逐渐变红，试管口有水珠。
H2+Cl2=2HCl|点燃|化合|acid|氢气在氯气中安静燃烧，发出苍白色火焰，瓶口有白雾。
C+2CuO=2Cu+CO2↑|高温|置换|carbon|黑色粉末逐渐变红，澄清石灰水变浑浊。
3C+2Fe2O3=4Fe+3CO2↑|高温|置换|carbon|红棕色粉末逐渐变黑，澄清石灰水变浑浊。
C+CO2=2CO|高温|化合|carbon|二氧化碳通过灼热的炭层，被还原成一氧化碳。
CaCO3+2HCl=CaCl2+H2O+CO2↑|常温|复分解|carbon|大理石（石灰石）表面产生大量气泡。
CaCO3=CaO+CO2↑|高温|分解|carbon|白色固体高温煅烧，生成白色固体和能使澄清石灰水变浑浊的气体（工业制生石灰）。
CO2+Ca(OH)2=CaCO3↓+H2O|常温|其他|carbon|澄清石灰水变浑浊（用来检验二氧化碳）。
CO2+2NaOH=Na2CO3+H2O|常温|其他|carbon|无明显现象（用氢氧化钠溶液吸收二氧化碳）。
2KOH+CO2=K2CO3+H2O|常温|其他|carbon|无明显现象（氢氧化钾溶液吸收二氧化碳）。
CaCO3+H2O+CO2=Ca(HCO3)2|常温|化合|carbon|浑浊的石灰水继续通入二氧化碳，沉淀溶解，溶液变澄清（溶洞的形成）。
Ca(HCO3)2=CaCO3↓+H2O+CO2↑|加热|分解|carbon|澄清溶液受热变浑浊，有气泡产生（钟乳石、水垢的形成）。
CO+CuO=Cu+CO2|加热|其他|carbon|黑色粉末逐渐变红，澄清石灰水变浑浊，尾气要点燃或收集。
6CO2+6H2O=C6H12O6+6O2|光照|其他|carbon|绿色植物吸收二氧化碳和水，在光照下合成葡萄糖并放出氧气（光合作用）。
C6H12O6+6O2=6CO2+6H2O|常温|其他|carbon|葡萄糖在体内缓慢氧化，放出能量（呼吸作用）。
CH4+2O2=CO2+2H2O|点燃|其他|fuel|甲烷燃烧发出淡蓝色火焰，烧杯内壁有水雾，澄清石灰水变浑浊。
C2H5OH+3O2=2CO2+3H2O|点燃|其他|fuel|酒精燃烧发出淡蓝色火焰，放出大量的热。
C3H8+5O2=3CO2+4H2O|点燃|其他|fuel|丙烷燃烧发出淡蓝色火焰，放出热量。
2C4H10+13O2=8CO2+10H2O|点燃|其他|fuel|丁烷燃烧，放出大量的热。
2C2H2+5O2=4CO2+2H2O|点燃|其他|fuel|乙炔燃烧火焰明亮并伴有浓烟，放出大量的热（氧炔焰用于切割、焊接金属）。
C2H4+3O2=2CO2+2H2O|点燃|其他|fuel|乙烯燃烧火焰明亮，伴有黑烟。
2CO+O2=2CO2|点燃|化合|fuel|一氧化碳燃烧，发出蓝色火焰，放出热量。
C+H2O=CO+H2|高温|置换|fuel|赤热的炭与水蒸气反应，生成一氧化碳和氢气（水煤气）。
3Fe+4H2O=Fe3O4+4H2|高温|置换|metal|红热的铁与水蒸气反应，生成黑色固体和可燃性气体。
Mg+2HCl=MgCl2+H2↑|常温|置换|metal|镁条剧烈反应，产生大量气泡，放出热量。
Zn+2HCl=ZnCl2+H2↑|常温|置换|metal|锌粒表面产生气泡。
Fe+2HCl=FeCl2+H2↑|常温|置换|metal|铁表面产生气泡，溶液逐渐变为浅绿色。
2Al+6HCl=2AlCl3+3H2↑|常温|置换|metal|铝表面产生气泡，放出热量。
Mg+H2SO4=MgSO4+H2↑|常温|置换|metal|镁条剧烈反应，产生大量气泡，放出热量。
Zn+H2SO4=ZnSO4+H2↑|常温|置换|metal|锌粒表面产生气泡（实验室制氢气）。
Fe+H2SO4=FeSO4+H2↑|常温|置换|metal|铁表面产生气泡，溶液逐渐变为浅绿色。
2Al+3H2SO4=Al2(SO4)3+3H2↑|常温|置换|metal|铝表面产生气泡，放出热量。
Fe+CuSO4=FeSO4+Cu|常温|置换|metal|铁表面覆盖一层红色固体，溶液由蓝色逐渐变为浅绿色（湿法炼铜）。
Zn+CuSO4=ZnSO4+Cu|常温|置换|metal|锌表面覆盖一层红色固体，溶液的蓝色逐渐变浅。
Mg+CuSO4=MgSO4+Cu|常温|置换|metal|镁表面覆盖一层红色固体，溶液的蓝色逐渐变浅。
2Al+3CuSO4=Al2(SO4)3+3Cu|常温|置换|metal|铝丝表面覆盖一层红色固体，溶液的蓝色逐渐变浅。
Fe+CuCl2=FeCl2+Cu|常温|置换|metal|铁表面覆盖一层红色固体，溶液由蓝绿色变为浅绿色。
Zn+Cu(NO3)2=Zn(NO3)2+Cu|常温|置换|metal|锌表面覆盖一层红色固体，溶液的蓝色逐渐变浅。
Fe+Cu(NO3)2=Fe(NO3)2+Cu|常温|置换|metal|铁表面覆盖一层红色固体，溶液由蓝色变为浅绿色。
Cu+2AgNO3=Cu(NO3)2+2Ag|常温|置换|metal|铜丝表面覆盖一层银白色固体，溶液由无色逐渐变为蓝色。
Fe+2AgNO3=Fe(NO3)2+2Ag|常温|置换|metal|铁表面覆盖一层银白色固体，溶液由无色变为浅绿色。
Zn+2AgNO3=Zn(NO3)2+2Ag|常温|置换|metal|锌表面覆盖一层银白色固体。
Mg+2AgNO3=Mg(NO3)2+2Ag|常温|置换|metal|镁表面覆盖一层银白色固体。
Al+3AgNO3=Al(NO3)3+3Ag|常温|置换|metal|铝丝表面覆盖一层银白色固体。
Zn+FeSO4=ZnSO4+Fe|常温|置换|metal|锌表面覆盖一层黑色固体，溶液由浅绿色变为无色。
Mg+FeSO4=MgSO4+Fe|常温|置换|metal|镁表面覆盖一层黑色固体，溶液由浅绿色变为无色。
2Al+3FeSO4=Al2(SO4)3+3Fe|常温|置换|metal|铝表面覆盖一层黑色固体，溶液由浅绿色变为无色。
3CO+Fe2O3=2Fe+3CO2|高温|其他|metal|红棕色粉末逐渐变黑，澄清石灰水变浑浊，尾气要处理（炼铁的原理）。
Fe3O4+4CO=3Fe+4CO2|高温|其他|metal|黑色粉末逐渐变为银白色的铁，澄清石灰水变浑浊。
3H2+Fe2O3=2Fe+3H2O|高温|置换|metal|红棕色粉末逐渐变黑，同时生成水。
WO3+3H2=W+3H2O|高温|置换|metal|黄色粉末被还原成金属钨，同时生成水。
2Al2O3=4Al+3O2↑|通电|分解|metal|熔融的氧化铝（加入冰晶石）通电，得到银白色的铝（工业炼铝）。
4Fe+3O2+6H2O=4Fe(OH)3|常温|化合|metal|铁在潮湿的空气中缓慢生锈，表面出现红褐色物质。
2Cu+O2+H2O+CO2=Cu2(OH)2CO3|常温|化合|metal|铜在潮湿的空气中表面慢慢生成绿色的铜绿。
Cu2(OH)2CO3=2CuO+H2O+CO2↑|加热|分解|metal|绿色粉末变黑，试管口有水珠，澄清石灰水变浑浊。
Fe2O3+6HCl=2FeCl3+3H2O|常温|复分解|acid|红棕色铁锈逐渐溶解，溶液由无色变为黄色（用盐酸除铁锈）。
Fe2O3+3H2SO4=Fe2(SO4)3+3H2O|常温|复分解|acid|红棕色铁锈逐渐溶解，溶液由无色变为黄色。
CuO+2HCl=CuCl2+H2O|常温|复分解|acid|黑色粉末逐渐溶解，溶液由无色变为蓝色。
CuO+H2SO4=CuSO4+H2O|加热|复分解|acid|黑色粉末逐渐溶解，溶液由无色变为蓝色。
MgO+2HCl=MgCl2+H2O|常温|复分解|acid|白色固体逐渐溶解。
ZnO+H2SO4=ZnSO4+H2O|常温|复分解|acid|白色固体逐渐溶解。
CaO+2HCl=CaCl2+H2O|常温|复分解|acid|白色固体逐渐溶解，放出热量。
NaOH+HCl=NaCl+H2O|常温|复分解|acid|无明显现象，放出热量（可用酚酞溶液由红色变无色证明发生了反应）。
2NaOH+H2SO4=Na2SO4+2H2O|常温|复分解|acid|无明显现象，放出热量。
KOH+HCl=KCl+H2O|常温|复分解|acid|无明显现象，放出热量。
Ca(OH)2+2HCl=CaCl2+2H2O|常温|复分解|acid|无明显现象（熟石灰可以中和酸性土壤、酸性废水）。
Ca(OH)2+H2SO4=CaSO4+2H2O|常温|复分解|acid|无明显现象，溶液中出现微溶的白色固体。
Ba(OH)2+H2SO4=BaSO4↓+2H2O|常温|复分解|acid|产生白色沉淀。
Al(OH)3+3HCl=AlCl3+3H2O|常温|复分解|acid|白色固体逐渐溶解（氢氧化铝可以治疗胃酸过多）。
Mg(OH)2+2HCl=MgCl2+2H2O|常温|复分解|acid|白色固体逐渐溶解。
Mg(OH)2+H2SO4=MgSO4+2H2O|常温|复分解|acid|白色固体逐渐溶解。
Cu(OH)2+2HCl=CuCl2+2H2O|常温|复分解|acid|蓝色沉淀逐渐溶解，溶液变为蓝绿色。
Cu(OH)2+H2SO4=CuSO4+2H2O|常温|复分解|acid|蓝色沉淀逐渐溶解，溶液变为蓝色。
Fe(OH)3+3HCl=FeCl3+3H2O|常温|复分解|acid|红褐色沉淀逐渐溶解，溶液变为黄色。
2NaOH+SO2=Na2SO3+H2O|常温|其他|acid|无明显现象（用氢氧化钠溶液吸收二氧化硫）。
Cu(OH)2=CuO+H2O|加热|分解|acid|蓝色固体变黑，试管口有水珠。
2Fe(OH)3=Fe2O3+3H2O|加热|分解|acid|红褐色固体变为红棕色，试管口有水珠。
Na2CO3+2HCl=2NaCl+H2O+CO2↑|常温|复分解|salt|产生大量气泡（反应比大理石快，不适合实验室制二氧化碳）。
NaHCO3+HCl=NaCl+H2O+CO2↑|常温|复分解|salt|产生大量气泡（小苏打可以治疗胃酸过多）。
K2CO3+2HCl=2KCl+H2O+CO2↑|常温|复分解|salt|产生大量气泡。
BaCO3+2HCl=BaCl2+H2O+CO2↑|常温|复分解|salt|白色固体溶解，产生气泡。
MgCO3+2HCl=MgCl2+H2O+CO2↑|常温|复分解|salt|白色固体溶解，产生气泡。
Na2CO3+H2SO4=Na2SO4+H2O+CO2↑|常温|复分解|salt|产生大量气泡。
2NaHCO3=Na2CO3+H2O+CO2↑|加热|分解|salt|白色固体受热，试管口有水珠，产生的气体使澄清石灰水变浑浊。
NH4HCO3=NH3↑+H2O+CO2↑|加热|分解|salt|白色固体受热消失，产生有刺激性气味的气体，试管口有水珠（碳铵要低温保存）。
Na2CO3+Ca(OH)2=CaCO3↓+2NaOH|常温|复分解|salt|产生白色沉淀（工业制烧碱）。
K2CO3+Ca(OH)2=CaCO3↓+2KOH|常温|复分解|salt|产生白色沉淀（草木灰不能和铵态氮肥混用也与此类碱性有关）。
Na2CO3+Ba(OH)2=BaCO3↓+2NaOH|常温|复分解|salt|产生白色沉淀。
Na2CO3+CaCl2=CaCO3↓+2NaCl|常温|复分解|salt|产生白色沉淀。
Na2CO3+BaCl2=BaCO3↓+2NaCl|常温|复分解|salt|产生白色沉淀。
Na2SO4+BaCl2=BaSO4↓+2NaCl|常温|复分解|salt|产生白色沉淀，沉淀不溶于稀硝酸（检验硫酸根）。
H2SO4+BaCl2=BaSO4↓+2HCl|常温|复分解|salt|产生白色沉淀，沉淀不溶于稀硝酸。
Ba(NO3)2+Na2SO4=BaSO4↓+2NaNO3|常温|复分解|salt|产生白色沉淀。
Ba(OH)2+Na2SO4=BaSO4↓+2NaOH|常温|复分解|salt|产生白色沉淀。
CuSO4+BaCl2=BaSO4↓+CuCl2|常温|复分解|salt|产生白色沉淀，溶液仍为蓝色。
CuSO4+Ba(OH)2=BaSO4↓+Cu(OH)2↓|常温|复分解|salt|同时产生白色沉淀和蓝色沉淀。
(NH4)2SO4+BaCl2=BaSO4↓+2NH4Cl|常温|复分解|salt|产生白色沉淀。
NaCl+AgNO3=AgCl↓+NaNO3|常温|复分解|salt|产生白色沉淀，沉淀不溶于稀硝酸（检验氯离子）。
HCl+AgNO3=AgCl↓+HNO3|常温|复分解|salt|产生白色沉淀，沉淀不溶于稀硝酸。
KCl+AgNO3=AgCl↓+KNO3|常温|复分解|salt|产生白色沉淀。
NH4Cl+AgNO3=AgCl↓+NH4NO3|常温|复分解|salt|产生白色沉淀。
CaCl2+2AgNO3=2AgCl↓+Ca(NO3)2|常温|复分解|salt|产生白色沉淀。
2NaOH+CuSO4=Cu(OH)2↓+Na2SO4|常温|复分解|salt|产生蓝色沉淀，溶液的蓝色变浅。
2NaOH+CuCl2=Cu(OH)2↓+2NaCl|常温|复分解|salt|产生蓝色沉淀。
3NaOH+FeCl3=Fe(OH)3↓+3NaCl|常温|复分解|salt|产生红褐色沉淀，溶液黄色变浅。
6NaOH+Fe2(SO4)3=2Fe(OH)3↓+3Na2SO4|常温|复分解|salt|产生红褐色沉淀。
2NaOH+MgCl2=Mg(OH)2↓+2NaCl|常温|复分解|salt|产生白色沉淀。
NaOH+NH4Cl=NaCl+NH3↑+H2O|常温|复分解|salt|产生有刺激性气味的气体，使湿润的红色石蕊试纸变蓝（检验铵根）。
2NaOH+(NH4)2SO4=Na2SO4+2NH3↑+2H2O|加热|复分解|salt|产生有刺激性气味的气体，使湿润的红色石蕊试纸变蓝。
NaOH+NH4NO3=NaNO3+NH3↑+H2O|加热|复分解|salt|产生有刺激性气味的气体，使湿润的红色石蕊试纸变蓝。
Ca(OH)2+2NH4Cl=CaCl2+2NH3↑+2H2O|加热|复分解|salt|产生有刺激性气味的气体（铵态氮肥不能与碱性物质混用）。
N2+3H2=2NH3|高温+催化剂|化合|salt|氮气和氢气在高温、高压和催化剂的作用下生成氨气（工业合成氨）。
NH3+HCl=NH4Cl|常温|化合|salt|浓氨水和浓盐酸靠近时产生白烟。
2NaOH+SO3=Na2SO4+H2O|常温|其他|acid|无明显现象（氢氧化钠溶液吸收三氧化硫）。
2KOH+H2SO4=K2SO4+2H2O|常温|复分解|acid|无明显现象，放出热量。
K2CO3+H2SO4=K2SO4+H2O+CO2↑|常温|复分解|salt|产生大量气泡。
2KOH+CuSO4=Cu(OH)2↓+K2SO4|常温|复分解|salt|产生蓝色沉淀。
Ca(OH)2+CuSO4=Cu(OH)2↓+CaSO4|常温|复分解|salt|产生蓝色沉淀（波尔多液中的反应之一，不能用铁桶盛放）。
Ca(OH)2+CuCl2=Cu(OH)2↓+CaCl2|常温|复分解|salt|产生蓝色沉淀。
Ba(OH)2+2HCl=BaCl2+2H2O|常温|复分解|acid|无明显现象，放出热量。
BaCl2+2AgNO3=2AgCl↓+Ba(NO3)2|常温|复分解|salt|产生白色沉淀。
2KOH+MgCl2=Mg(OH)2↓+2KCl|常温|复分解|salt|产生白色沉淀。
AlCl3+3NaOH=Al(OH)3↓+3NaCl|常温|复分解|salt|产生白色胶状沉淀。
Fe2(SO4)3+3Ba(OH)2=2Fe(OH)3↓+3BaSO4↓|常温|复分解|salt|同时产生红褐色沉淀和白色沉淀。
(NH4)2SO4+Ba(OH)2=BaSO4↓+2NH3↑+2H2O|加热|复分解|salt|产生白色沉淀和有刺激性气味的气体。
Al2O3+6HCl=2AlCl3+3H2O|常温|复分解|acid|白色固体逐渐溶解。
Al2O3+3H2SO4=Al2(SO4)3+3H2O|常温|复分解|acid|白色固体逐渐溶解。
ZnO+2HCl=ZnCl2+H2O|常温|复分解|acid|白色固体逐渐溶解。
MgO+H2SO4=MgSO4+H2O|常温|复分解|acid|白色固体逐渐溶解。
2Mg+CO2=2MgO+C|点燃|置换|carbon|镁条在二氧化碳中继续燃烧，生成白色固体和黑色固体。
NH3+HNO3=NH4NO3|常温|化合|salt|氨气与硝酸反应生成硝酸铵（一种氮肥）。
2NH3+H2SO4=(NH4)2SO4|常温|化合|salt|氨气与硫酸反应生成硫酸铵（一种氮肥）。
`.trim().split("\n").map((l) => l.split("|"));

// formula | name | alias | category (elem 单质, oxide 氧化物, acid 酸, base 碱, salt 盐, org 有机物, other)
const SUBS = `
O2|氧气||elem
H2|氢气||elem
N2|氮气||elem
Cl2|氯气||elem
C|碳|金刚石、石墨、木炭|elem
S|硫|硫磺|elem
P|磷|红磷|elem
Fe|铁||elem
Cu|铜||elem
Zn|锌||elem
Mg|镁||elem
Al|铝||elem
Hg|汞|水银|elem
Ag|银||elem
W|钨||elem
H2O|水||oxide
CO2|二氧化碳|固态叫干冰|oxide
CO|一氧化碳||oxide
SO2|二氧化硫||oxide
SO3|三氧化硫||oxide
NO|一氧化氮||oxide
NO2|二氧化氮||oxide
P2O5|五氧化二磷||oxide
Fe2O3|氧化铁|铁锈的主要成分|oxide
Fe3O4|四氧化三铁||oxide
CuO|氧化铜||oxide
MgO|氧化镁||oxide
CaO|氧化钙|生石灰|oxide
Al2O3|氧化铝||oxide
HgO|氧化汞||oxide
ZnO|氧化锌||oxide
MnO2|二氧化锰||oxide
H2O2|过氧化氢|双氧水|oxide
WO3|三氧化钨||oxide
Na2O|氧化钠||oxide
HCl|盐酸|氢氯酸|acid
H2SO4|硫酸||acid
HNO3|硝酸||acid
H2CO3|碳酸||acid
H2SO3|亚硫酸||acid
CH3COOH|乙酸|醋酸|acid
NaOH|氢氧化钠|烧碱、火碱、苛性钠|base
KOH|氢氧化钾||base
Ca(OH)2|氢氧化钙|熟石灰、消石灰|base
Ba(OH)2|氢氧化钡||base
Cu(OH)2|氢氧化铜||base
Fe(OH)3|氢氧化铁||base
Mg(OH)2|氢氧化镁||base
Al(OH)3|氢氧化铝||base
NaCl|氯化钠|食盐|salt
Na2CO3|碳酸钠|纯碱、苏打|salt
NaHCO3|碳酸氢钠|小苏打|salt
CaCO3|碳酸钙|大理石、石灰石的主要成分|salt
CuSO4|硫酸铜||salt
CuSO4·5H2O|五水硫酸铜|胆矾、蓝矾|salt
KMnO4|高锰酸钾|灰锰氧|salt
K2MnO4|锰酸钾||salt
KClO3|氯酸钾||salt
KCl|氯化钾||salt
AgNO3|硝酸银||salt
AgCl|氯化银||salt
BaSO4|硫酸钡||salt
BaCl2|氯化钡||salt
BaCO3|碳酸钡||salt
Ba(NO3)2|硝酸钡||salt
Na2SO4|硫酸钠||salt
Na2SO3|亚硫酸钠||salt
NaNO3|硝酸钠||salt
K2CO3|碳酸钾|草木灰的主要成分|salt
KNO3|硝酸钾||salt
K2SO4|硫酸钾||salt
CaCl2|氯化钙||salt
CaSO4|硫酸钙||salt
Ca(NO3)2|硝酸钙||salt
MgCl2|氯化镁||salt
MgSO4|硫酸镁||salt
MgCO3|碳酸镁||salt
Mg(NO3)2|硝酸镁||salt
FeCl3|氯化铁||salt
FeCl2|氯化亚铁||salt
FeSO4|硫酸亚铁||salt
Fe2(SO4)3|硫酸铁||salt
Fe(NO3)2|硝酸亚铁||salt
FeS|硫化亚铁||salt
ZnCl2|氯化锌||salt
ZnSO4|硫酸锌||salt
Zn(NO3)2|硝酸锌||salt
AlCl3|氯化铝||salt
Al2(SO4)3|硫酸铝||salt
Al(NO3)3|硝酸铝||salt
CuCl2|氯化铜||salt
Cu(NO3)2|硝酸铜||salt
NH4Cl|氯化铵||salt
(NH4)2SO4|硫酸铵||salt
NH4HCO3|碳酸氢铵|碳铵|salt
NH4NO3|硝酸铵||salt
Cu2(OH)2CO3|碱式碳酸铜|铜绿|salt
Ca(HCO3)2|碳酸氢钙||salt
CH4|甲烷|沼气、天然气的主要成分|org
C2H5OH|乙醇|酒精|org
C3H8|丙烷||org
C4H10|丁烷||org
C2H2|乙炔||org
C2H4|乙烯||org
C6H12O6|葡萄糖||org
CO(NH2)2|尿素||org
NH3|氨气||other
`.trim().split("\n").map((l) => { const [f, n, a, c] = l.split("|"); return { f, n, a, c }; });

const MIX = [["空气", "氮气约占78%，氧气约占21%"], ["稀盐酸", "氯化氢气体的水溶液"], ["澄清石灰水", "氢氧化钙的水溶液"], ["食盐水", "氯化钠的水溶液"], ["生铁", "含碳量较高的铁合金"], ["钢", "含碳量较低的铁合金"], ["黄铜", "铜和锌的合金"], ["石油", "多种碳氢化合物的混合物"], ["煤", "主要含碳的混合物"], ["天然气", "主要成分是甲烷"], ["碘酒", "碘的酒精溶液"], ["矿泉水", "含有多种矿物质的水"], ["大理石", "主要成分是碳酸钙的岩石"], ["雨水", "溶有二氧化碳等的水"], ["白酒", "乙醇和水等的混合物"]].map(([n, a]) => ({ n, a }));

const EL = [["H", "氢", 1, [1]], ["Li", "锂", 7, [1]], ["C", "碳", 12, [4, 2, -4]], ["N", "氮", 14, [-3, 2, 4, 5]], ["O", "氧", 16, [-2]], ["F", "氟", 19, [-1]], ["Na", "钠", 23, [1]], ["Mg", "镁", 24, [2]], ["Al", "铝", 27, [3]], ["Si", "硅", 28, [4]], ["P", "磷", 31, [5]], ["S", "硫", 32, [-2, 4, 6]], ["Cl", "氯", 35.5, [-1, 1, 5, 7]], ["K", "钾", 39, [1]], ["Ca", "钙", 40, [2]], ["Mn", "锰", 55, [7, 6, 4, 2]], ["Fe", "铁", 56, [2, 3]], ["Cu", "铜", 64, [2, 1]], ["Zn", "锌", 65, [2]], ["Ag", "银", 108, [1]], ["Ba", "钡", 137, [2]], ["W", "钨", 184, [6]], ["Hg", "汞", 201, [2]]].map(([s, n, ar, v]) => ({ s, n, ar, v }));
const GROUPS = [["OH", "氢氧根", -1], ["NO3", "硝酸根", -1], ["SO4", "硫酸根", -2], ["CO3", "碳酸根", -2], ["NH4", "铵根", 1], ["PO4", "磷酸根", -3], ["MnO4", "高锰酸根", -1], ["ClO3", "氯酸根", -1], ["HCO3", "碳酸氢根", -1]].map(([f, n, c]) => ({ f, n, c }));

// ions of the solubility table: s = soluble, i = insoluble, m = slightly soluble, v = soluble and volatile (decomposes / escapes), - = does not exist
const CATIONS = ["H", "NH4", "K", "Na", "Ba", "Ca", "Mg", "Al", "Zn", "Fe2", "Fe3", "Cu", "Ag"];
const CATZH = ["氢", "铵", "钾", "钠", "钡", "钙", "镁", "铝", "锌", "亚铁", "铁", "铜", "银"];
const CATCH = [1, 1, 1, 1, 2, 2, 2, 3, 2, 2, 3, 2, 1];
const ANIONS = ["OH", "NO3", "Cl", "SO4", "CO3"];
// parts of the names of ionic compounds (氯化钠, 硫酸铜, 氢氧化钙, 盐酸 ...)
const NAMES = { an: { Cl: "氯", O: "氧", S: "硫", OH: "氢氧", NO3: "硝酸", SO4: "硫酸", CO3: "碳酸", PO4: "磷酸" }, hua: "化", qingyanghua: "氢氧化", yansuan: "盐酸", qingliusuan: "氢硫酸", shui: "水", cat: { H: "氢", Na: "钠", K: "钾", Ag: "银", Mg: "镁", Ca: "钙", Ba: "钡", Zn: "锌", Al: "铝", Fe2: "亚铁", Fe3: "铁", Cu: "铜", NH4: "铵" } };
const SOL = {
  OH:  ["-", "v", "s", "s", "s", "m", "i", "i", "i", "i", "i", "i", "-"],
  NO3: ["v", "s", "s", "s", "s", "s", "s", "s", "s", "s", "s", "s", "s"],
  Cl:  ["v", "s", "s", "s", "s", "s", "s", "s", "s", "s", "s", "s", "i"],
  SO4: ["s", "s", "s", "s", "i", "m", "s", "s", "s", "s", "s", "s", "m"],
  CO3: ["v", "s", "s", "s", "i", "i", "m", "-", "i", "i", "-", "-", "i"],
};
const ACTIVITY = ["K", "Ca", "Na", "Mg", "Al", "Zn", "Fe", "Sn", "Pb", "H", "Cu", "Hg", "Ag", "Pt", "Au"];
const INDICATORS = [
  { n: "紫色石蕊溶液", acid: "红色", neutral: "紫色", base: "蓝色" },
  { n: "无色酚酞溶液", acid: "无色", neutral: "无色", base: "红色" },
];
// pH of everyday substances (typical values)
const PH = [["胃液", 1.5], ["柠檬汁", 2], ["食醋", 3], ["橙汁", 3.5], ["酸雨", 4.5], ["雨水", 5.6], ["牛奶", 6.5], ["纯水", 7], ["食盐水", 7], ["血液", 7.4], ["小苏打溶液", 8.3], ["肥皂水", 10], ["草木灰水", 11], ["石灰水", 12], ["炉具清洁剂", 12.5], ["氢氧化钠溶液", 13]].map(([n, v]) => ({ n, v }));
// solubility (g per 100 g water) at 0 20 40 60 80 100 degrees C (rounded values from the usual textbook curves)
const SOLUB = { T: [0, 20, 40, 60, 80, 100], d: [
  { f: "KNO3", n: "硝酸钾", v: [13.3, 31.6, 63.9, 110, 169, 246] },
  { f: "NaCl", n: "氯化钠", v: [35.7, 36.0, 36.6, 37.3, 38.4, 39.8] },
  { f: "NH4Cl", n: "氯化铵", v: [29.4, 37.2, 45.8, 55.2, 65.6, 77.3] },
  { f: "KCl", n: "氯化钾", v: [27.6, 34.0, 40.0, 45.5, 51.1, 56.7] },
  { f: "CuSO4", n: "硫酸铜", v: [14.3, 20.7, 28.5, 40.0, 55.0, 75.4] },
  { f: "Ca(OH)2", n: "氢氧化钙", v: [0.18, 0.16, 0.14, 0.11, 0.09, 0.07] }] };
// gases of the laboratory (generator A = solid + heating, B = solid + liquid at room temperature; collection C = over water, D = upward air displacement, E = downward air displacement)
const GASES = [
  { f: "O2", n: "氧气", rx: ["2KMnO4=K2MnO4+MnO2+O2↑", "2KClO3=2KCl+3O2↑", "2H2O2=2H2O+O2↑"], gen: { "2KMnO4=K2MnO4+MnO2+O2↑": "A", "2KClO3=2KCl+3O2↑": "A", "2H2O2=2H2O+O2↑": "B" }, col: ["C", "D"], why: "氧气不易溶于水，密度比空气大。", test: "把带火星的木条伸入集气瓶，木条复燃。", full: "把带火星的木条放在瓶口，木条复燃。", bad: [["高锰酸钾溶液和稀盐酸", "高锰酸钾溶液与稀盐酸混合不会放出氧气。"], ["大理石和稀盐酸", "这一组反应放出的是二氧化碳。"]] },
  { f: "H2", n: "氢气", rx: ["Zn+H2SO4=ZnSO4+H2↑"], gen: { "Zn+H2SO4=ZnSO4+H2↑": "B" }, col: ["C", "E"], why: "氢气难溶于水，密度比空气小。", test: "点燃，产生淡蓝色火焰；混有空气时点燃会发出爆鸣声。", full: "用排水法收集，集气瓶口有气泡冒出时已满。", bad: [["铜片和稀硫酸", "铜排在氢的后面，不能与稀硫酸反应放出氢气。"], ["锌粒和浓硝酸", "浓硝酸有强氧化性，反应放出的不是氢气。"]] },
  { f: "CO2", n: "二氧化碳", rx: ["CaCO3+2HCl=CaCl2+H2O+CO2↑"], gen: { "CaCO3+2HCl=CaCl2+H2O+CO2↑": "B" }, col: ["D"], why: "二氧化碳能溶于水，密度比空气大，所以用向上排空气法。", test: "通入澄清石灰水，石灰水变浑浊。", full: "把燃着的木条放在瓶口，木条熄灭。", bad: [["大理石和稀硫酸", "生成的硫酸钙微溶，覆盖在大理石表面，反应会逐渐停止。"], ["碳酸钠粉末和稀盐酸", "反应太快，不容易控制和收集。"], ["木炭在氧气中燃烧", "产物不纯，收集不到纯净的二氧化碳。"]] },
];
// words used to put a description into a sentence (kept in the data so that no Chinese literal is needed in the code)
const SAY = { and: "和", under: "在", byCat: "的作用下", byCond: "的条件下", mid: "反应，生成", end: "。" };
const PHKEYS = ["白色沉淀", "蓝色沉淀", "红褐色沉淀", "气泡", "淡蓝色火焰", "蓝紫色火焰", "蓝色火焰", "火星四射", "白烟", "石蕊溶液，溶液变红", "变黑", "变红", "变蓝", "浅绿色", "变为黄色", "刺激性气味", "水珠", "耀眼", "放出大量的热", "浑浊", "无明显现象"];
const CHAPTERS = { air: "空气和氧气", water: "自然界的水", carbon: "碳和碳的氧化物", fuel: "燃料及其利用", metal: "金属和金属材料", acid: "酸和碱", salt: "盐和化肥" };

// ---------- checks ----------
const parse = (f) => {
  const [main, ...hyd] = f.split("·"); const tot = {};
  const add = (s, k) => { const st = [{}]; let i = 0; while (i < s.length) { const c = s[i]; if (c === "(") { st.push({}); i++; } else if (c === ")") { i++; let n = ""; while (/\d/.test(s[i] || "")) n += s[i++]; const top = st.pop(); for (const [e, v] of Object.entries(top)) st[st.length - 1][e] = (st[st.length - 1][e] || 0) + v * (n ? +n : 1); } else { const m = /^[A-Z][a-z]?/.exec(s.slice(i)); if (!m) throw new Error("bad formula " + f); i += m[0].length; let n = ""; while (/\d/.test(s[i] || "")) n += s[i++]; st[st.length - 1][m[0]] = (st[st.length - 1][m[0]] || 0) + (n ? +n : 1); } } for (const [e, v] of Object.entries(st[0])) tot[e] = (tot[e] || 0) + v * k; };
  add(main, 1);
  for (const x of hyd) { const m = /^(\d*)(.*)$/.exec(x); add(m[2], m[1] ? +m[1] : 1); }
  return tot;
};
const names = new Map(SUBS.map((s) => [s.f, s]));
let bad = 0; const seen = new Set();
const side = (s) => s.split("+").map((t) => { const m = /^(\d*)(.+?)[↑↓]?$/.exec(t); return { c: m[1] ? +m[1] : 1, f: m[2] }; });
for (const [eq] of RX) {
  const [l, r] = eq.split("="); const cnt = (s) => { const o = {}; for (const { c, f } of side(s)) { if (!names.has(f)) { console.log("no name for", f, "in", eq); bad++; } for (const [e, n] of Object.entries(parse(f))) o[e] = (o[e] || 0) + n * c; } return o; };
  const a = cnt(l), b = cnt(r);
  for (const e of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[e] !== b[e]) { console.log("NOT BALANCED", eq, e, a[e], b[e]); bad++; }
  if (seen.has(eq)) { console.log("duplicate", eq); bad++; } seen.add(eq);
}
for (const s of SUBS) { const el = Object.keys(parse(s.f)); for (const e of el) if (!EL.find((x) => x.s === e)) { console.log("no Ar for", e, s.f); bad++; } }
if (bad) { console.log(bad + " problem(s)"); process.exit(1); }

const reactions = RX.map(([eq, cond, type, ch, ph], i) => ({ id: "r" + String(i + 1).padStart(3, "0"), eq, cond: cond.split("+"), type, ch, ph }));
fs.writeFileSync(out, JSON.stringify({ chapters: CHAPTERS, reactions, subs: SUBS, mix: MIX, elements: EL, groups: GROUPS, ions: { cat: CATIONS, catZh: CATZH, catCh: CATCH, an: ANIONS, sol: SOL }, say: SAY, names: NAMES, phKeys: PHKEYS, activity: ACTIVITY, indicators: INDICATORS, ph: PH, solub: SOLUB, gases: GASES }));
console.log("ok: " + reactions.length + " reactions, " + SUBS.length + " substances, " + (fs.statSync(out).size / 1024).toFixed(0) + " KB");
