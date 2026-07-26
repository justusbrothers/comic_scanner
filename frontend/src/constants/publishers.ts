import type { PublisherConfig } from '../types/comic';

export const PUBLISHER_REGISTRY: PublisherConfig[] = [
  {
    name: 'Abstract Studio',
    code: 'ABS',
    prefixes: ['89317'],
    catId: 22,
    locId: 82
  },
  {
    name: 'Action Lab Comics',
    code: 'ALC',
    prefixes: ['78430'],
    catId: 22,
    locId: 82
  },
  { name: 'Archie Comics', code: 'ARCH', prefixes: [], catId: 22, locId: null },
  {
    name: 'Bad Idea Studios',
    code: 'BAD',
    prefixes: ['85001'],
    catId: 22,
    locId: 82
  },
  {
    name: 'Boom! Studios',
    code: 'BOOM',
    prefixes: ['84428'],
    catId: 22,
    locId: 82
  },
  { name: 'DC Comics', code: 'DC', prefixes: ['761941'], catId: 22, locId: 82 },
  {
    name: 'Dynamite Entertainment',
    code: 'DYN',
    prefixes: ['725130'],
    catId: 22,
    locId: 82
  },
  {
    name: 'IDW Publishing',
    code: 'IDW',
    prefixes: ['827714'],
    catId: 22,
    locId: 82
  },
  {
    name: 'Image Comics',
    code: 'IMG',
    prefixes: ['709853'],
    catId: 22,
    locId: 82
  },
  {
    name: 'Marvel Comics',
    code: 'MAR',
    prefixes: ['759606'],
    catId: 22,
    locId: 82
  }
];

export const DEFAULT_CATEGORY_ID = 22;
export const DEFAULT_LOCATION_ID = 82;
