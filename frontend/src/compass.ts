import { HEXAGRAM_NAMES } from "./hexagrams";

export type HexagramSector = {
  number: number;
  name: string;
  angle: number;
};

export function createHexagramSectors(): HexagramSector[] {
  return HEXAGRAM_NAMES.map((name, index) => ({
    number: index + 1,
    name,
    angle: index * (360 / HEXAGRAM_NAMES.length)
  }));
}

export function findHexagramSector(number: number): HexagramSector | undefined {
  return createHexagramSectors().find((sector) => sector.number === number);
}
