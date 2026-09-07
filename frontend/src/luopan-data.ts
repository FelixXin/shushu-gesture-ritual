import { HEXAGRAM_NAMES } from "./hexagrams";

export type LuopanLayer = {
  id: string;
  label: string;
  innerRadius: number;
  outerRadius: number;
  spatialDepth: number;
  tokenCount: number;
  tokens: readonly string[];
};

export const HEXAGRAM_SECTOR_COUNT = 64;

const BAGUA = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"];
const NINE_STARS = ["一白", "二黑", "三碧", "四绿", "五黄", "六白", "七赤", "八白", "九紫"];
const HEAVEN_STARS = ["天皇", "天厩", "天鬼", "天乙", "少微", "天汉", "天关", "天战", "天帝", "南极", "天马", "太微", "天屏", "太乙", "天罡", "天官", "天命", "天苑", "天棓", "天市", "天厨", "天魁", "天垒", "天辅"];
const MOUNTAINS = ["壬", "子", "癸", "丑", "艮", "寅", "甲", "卯", "乙", "辰", "巽", "巳", "丙", "午", "丁", "未", "坤", "申", "庚", "酉", "辛", "戌", "乾", "亥"];
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const JIAZI = Array.from({ length: 60 }, (_, index) => `${STEMS[index % 10]}${BRANCHES[index % 12]}`);
const DRAGONS = Array.from({ length: 72 }, (_, index) => JIAZI[index % JIAZI.length]);
const MANSIONS = ["角", "亢", "氐", "房", "心", "尾", "箕", "斗", "牛", "女", "虚", "危", "室", "壁", "奎", "娄", "胃", "昴", "毕", "觜", "参", "井", "鬼", "柳", "星", "张", "翼", "轸"];
const SOLAR_TERMS = ["立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至", "小寒", "大寒"];
const DEGREES = Array.from({ length: 360 }, (_, index) => String(index));

const layer = (
  id: string,
  label: string,
  innerRadius: number,
  outerRadius: number,
  spatialDepth: number,
  tokens: readonly string[]
): LuopanLayer => ({ id, label, innerRadius, outerRadius, spatialDepth, tokenCount: tokens.length, tokens });

export const LUOPAN_LAYERS: readonly LuopanLayer[] = [
  layer("taiji", "天池太极", 0, 0.48, 1.3, ["☯"]),
  layer("bagua", "先天八卦", 0.48, 0.82, -0.08, BAGUA),
  layer("luoshu-nine-stars", "洛书九星", 0.82, 1.07, 0.08, NINE_STARS),
  layer("heaven-stars", "二十四天星", 1.07, 1.3, -0.15, HEAVEN_STARS),
  layer("earth-needle", "地盘正针", 1.3, 1.53, 0.18, MOUNTAINS),
  layer("seventy-two-dragons", "穿山七十二龙", 1.53, 1.72, -0.28, DRAGONS),
  layer("human-needle", "人盘中针", 1.72, 1.95, 0.36, MOUNTAINS),
  layer("sixty-dragons", "透地六十龙", 1.95, 2.14, -0.47, JIAZI),
  layer("heaven-needle", "天盘缝针", 2.14, 2.37, 0.57, MOUNTAINS),
  layer("one-twenty-divisions", "一百二十分金", 2.37, 2.54, -0.68, Array.from({ length: 120 }, (_, index) => String(index + 1))),
  layer("hexagrams", "六十四卦", 2.54, 2.74, 0.8, HEXAGRAM_NAMES),
  layer("mansions", "二十八星宿", 2.74, 2.95, -0.93, MANSIONS),
  layer("solar-terms", "二十四节气", 2.95, 3.16, 1.07, SOLAR_TERMS),
  layer("heavenly-degrees", "周天刻度", 3.16, 3.35, -1.22, DEGREES)
];

export function hexagramSectorAngle(number: number): number | undefined {
  if (!Number.isInteger(number) || number < 1 || number > HEXAGRAM_SECTOR_COUNT) return undefined;
  return (number - 1) * (360 / HEXAGRAM_SECTOR_COUNT);
}

export function layerById(id: string): LuopanLayer | undefined {
  return LUOPAN_LAYERS.find((layerDefinition) => layerDefinition.id === id);
}
