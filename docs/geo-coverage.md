# 地理实验室 (Geography lab): what is covered

`#/science/geo` (a card on the science home, for everybody, no child needed). Primary-school 常识 + junior-high geography (七年级上下, 八年级上下, 2022 课程标准, textbook-neutral).
Every module = a short lesson, an interactive drawing, 3-4 checked tasks (实验任务) and a 5-question quiz made on the spot; `#/science/geo/practice` mixes the questions of every module
(or one) and keeps the memory boxes of `game.ts` (1 / 3 / 7 / 14 / 30 days) on this device (`learn.geolab.practice.v1`; tasks and best quiz scores: `learn.geolab.v1`).

All content (`src/data/geolab.json`: lessons, 154 bank questions, 117 fact entries, 13 climate stations, 18 countries of the development scatter) was written FROM MEMORY by a model.
**A teacher must proofread every lesson, number, grade placement and fact.** Entries marked `check: true` are the least certain (a note is shown on their card); the climate station
tables are approximate monthly means; the countries' GDP per person and birth rates are rounded values for practice only. Nothing is copied from a textbook.

| Topic asked for | Module (id) | Interactive part | Questions |
|---|---|---|---|
| 地球与地球仪: 经纬线、经纬度定位、半球、五带 | 地球与经纬网 (`globe`) | draggable pin on a world grid with zones, tropics, circles, the 20°W / 160°E split | zone, hemisphere, distance per degree, parallel length, direction + bank |
| 时区与日界线计算 | 时区与日界线 (`timezone`) | 25 zone columns, a draggable sun line, date shading, 4 cities, the date line | time + date conversion, zone of a longitude, zone difference + bank |
| 地球自转公转, 昼夜与四季 (links to the astronomy lab, uses its `declination` / `dayLength` / `noonElevation`) | 昼夜与四季 (`seasons`) | orbit view + side view of noon rays at the direct-sun latitude | noon height, latitude from noon height, direct-sun line + bank |
| 地图三要素: 比例尺、方向、图例 | 地图的三要素 (`scale`) | draggable point B, ruler, line scale, north arrow, legend symbols | real distance, map distance, scale from "1 cm = k km" + bank |
| 等高线与地形图: draw / read, slope, summit, ridge, valley, profile | 等高线与地形图 (`contour`) | draggable hill that redraws coloured contours (marching squares) and the profile A-B | relative height, temperature drop with height, slope + bank |
| 地形类型 | 五种地形 (`terrain`) | altitude, relative height, surface type give the landform; cross-section drawing | classification, bank |
| 中国地势三级阶梯 | 中国地势三级阶梯 (`chinaterrain`) | schematic profile with a draggable marker, rivers flowing east, a card per step | step of a longitude + bank |
| 天气与气候: 气温曲线与降水柱状图判读、气候类型、季风、影响因素 | 气温曲线与降水柱状图 (`climate`) | 13 real stations as temperature curve + rainfall bars, answer hidden / shown | climate type from numbers (11 types, north and south), annual range + bank (factors, monsoon, currents) |
| 天气符号与预报 | 天气与天气预报 (`weather`) | forecast card: sky, rain, wind vane, force, temperature bars | Beaufort force, rain grade, wind name, daily range + bank |
| 陆地与海洋分布 | 大洲、大洋与陆海分布 (`continents`) | 7 continents + 4 oceans on a world grid, cards | area, features, highest peak, longest river, boundaries (bank) |
| 世界人口 / 人种 / 语言 / 宗教 / 聚落 | 人口与人种、语言、宗教 (`population`) | growth curve + three pyramids | growth rate, population after n years, density, pyramid type + bank (races, languages, religions, settlements) |
| 发展中与发达国家 | 发展中国家与发达国家 (`development`) | scatter of 18 countries (GDP per person against birth rate), draggable dividing line | richest of four + bank (North-South gap, cooperation) |
| 世界地理: 日本 东南亚 南亚 西亚 俄罗斯 欧洲西部 澳大利亚 美国 巴西 + polar regions + several capitals; the world map of `src/geomap*.ts` | 世界重要地区与国家 (`regions`, 18 entries) | box on a world grid + a card; link to `#/science/map` | location, natural features, economy, capital (also reverse) + bank |
| 中国地理: 疆域 行政区 人口民族 | 我们的国家 (`chinabasic`) | draggable pin on China's lat / lon frame, 8 cities, extent rectangle (a bounding box, not a border), local solar time | local time from longitude, time span + bank (extent, divisions, peoples) |
| 中国自然: 河湖 山脉 地形 气候 | 中国的山河湖泊与地形 (`chinanature`, 27 entries) | box on the China frame + card | kind, location, features, outlet, direction + bank (monsoon, rivers, lakes) |
| 中国农业 工业 交通 资源 | 中国的农业、工业与交通 (`chinaecon`, 23 entries) | box on the China frame + card | main products, features, route + bank (西气东输, 南水北调 ...) |
| 四大地理区域 北方 南方 西北 青藏 + 香港澳门台湾 + 省区特色 + 乡土, 东西南北差异, 区域联系 | 四大地理区域与省区 (`chinaregions`) | the 34 provinces drawn from `geomap-china.json` (the project's own border data, rule 53), coloured by region or one highlighted, tap to choose, a card with abbreviation / capital / feature | abbreviation, capital (both ways), feature, region range / climate / terrain / farming + bank |
| 地球上的自然灾害: 板块运动 地震火山 | 板块、地震与火山 (`plates`) | cross-sections of divergent, collision and subduction boundaries over time; P / S waves and a seismogram | plate distance, S-P gap, epicentral distance, energy ratio + bank |
| 水循环 | 水循环 (`watercycle`) | diagram with 7 stages, flux arrows follow sun and forest cover | water balance + bank |
| 岩石圈, 内外力, 岩石循环 | 岩石圈、岩石与内外力 (`rocks`) | layers of the Earth with a depth marker; rock cycle with the process highlighted | layer of a depth, ground temperature + bank |
| 资源与环境, 可持续发展 | 资源、环境与可持续发展 (`sustain`) | energy mix sliders, stacked bar, CO₂ gauge | per-person resource, forest cover, emission index + bank |

## Not built / limits

* The world drawing in the grid modules is a rough outline for finding places, not a map; real borders are in `#/science/map` (Natural Earth, China's point of view: 台湾 / 香港 / 澳门 / 藏南 / 南海诸岛 are China). The lab itself draws no border except the provinces from `geomap-china.json`.
* Regional geography below province level (a student's own 乡土 / home region) is covered only by the province cards; there is no module for a free local study.
* 聚落 (settlements), 人种 / 语言 / 宗教 and 区域联系 (西气东输, 南水北调, 东西部差异) are question banks without an own drawing.
* The four regions of China are coloured by province, so border provinces (内蒙古, 陕西, 四川, 安徽, 江苏) are only indicative. 内蒙古 is coloured as 西北 (its larger part).
* Climate types follow a school-level rule table (`climateOf`); tropical monsoon vs. savanna is decided by annual rainfall (about 1900 mm), which is a simplification of the textbook's wind-based definition.
* The staircase profile is schematic (`STEP_PTS`), not a real section; its step boundaries (102.5°E, 111°E) are approximate.
* The explorer buttons show the Chinese names of places (content, `user`); lessons, banks, facts and quiz texts are Chinese content in every language, only the frame (titles, labels, tasks, buttons) is translated.
* Not tested: real fingers / Apple Pencil on a real iPad, the feel and look on real devices, and above all the content.
