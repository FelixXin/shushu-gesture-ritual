export const HEXAGRAM_NAMES = [
  "乾", "坤", "屯", "蒙", "需", "讼", "师", "比",
  "小畜", "履", "泰", "否", "同人", "大有", "谦", "豫",
  "随", "蛊", "临", "观", "噬嗑", "贲", "剥", "复",
  "无妄", "大畜", "颐", "大过", "坎", "离", "咸", "恒",
  "遁", "大壮", "晋", "明夷", "家人", "睽", "蹇", "解",
  "损", "益", "夬", "姤", "萃", "升", "困", "井",
  "革", "鼎", "震", "艮", "渐", "归妹", "丰", "旅",
  "巽", "兑", "涣", "节", "中孚", "小过", "既济", "未济"
] as const;

export type LineValue = 6 | 7 | 8 | 9;

export function castCoinLine(randomByte: number): LineValue {
  const coinBits = randomByte & 0b111;
  const heads = (coinBits & 1) + ((coinBits >> 1) & 1) + ((coinBits >> 2) & 1);
  return (6 + heads) as LineValue;
}

export function linePresentation(value: number): { kind: "yin" | "yang"; moving: boolean } {
  if (![6, 7, 8, 9].includes(value)) {
    throw new Error("line value must be 6, 7, 8, or 9");
  }
  return {
    kind: value === 6 || value === 8 ? "yin" : "yang",
    moving: value === 6 || value === 9
  };
}
