/** The data center row: where every rack, desk and prop stands, in world units.
 * The back wall's base is FLOOR_Y; Aron walks in front of it at ARON_Y.
 */
export const FLOOR_Y = 470;
export const ARON_Y = 562;
export const RACK_HEIGHT = 330;
export const ROW_LENGTH = 2820;

// Real American Cloud products. `sprite` is the rack art; the placard shows
// `sign`, or `name` in capitals.
export const RACKS = [
  { id: 'vms', name: 'VMs', sign: 'VMs', x: 330, sprite: 'rack' },
  { id: 'kubernetes', name: 'Kubernetes', x: 500, sprite: 'rack-open' },
  { id: 'object', name: 'Object Storage', x: 680, sprite: 'rack' },
  { id: 'block', name: 'Block Storage', x: 850, sprite: 'rack' },
  { id: 'lb', name: 'Load Balancers', x: 1600, sprite: 'network' },
  { id: 'databases', name: 'Databases', x: 1780, sprite: 'rack' },
  { id: 'dns', name: 'DNS', x: 1950, sprite: 'rack-open' },
  { id: 'wordpress', name: 'WordPress', x: 2120, sprite: 'rack' },
  { id: 'vpc', name: 'VPC Networks', x: 2290, sprite: 'network' },
];

export const HELP_DESK = { x: 1130 };
export const COFFEE = { x: 1300 };
export const START_X = 1060;

// Scenery: [sprite sheet, name, x, y (feet), height, options].
export const SCENERY = {
  back: [
    ['racks', 'door', 95, FLOOR_Y, 318],
    ['props', 'extinguisher', 415, 318, 70],
    ['props', 'extinguisher', 1690, 318, 70],
    ['props', 'extinguisher', 2205, 318, 70],
    ['props', 'red-button', 2690, 300, 52],
    ['racks', 'cooling', 2520, FLOOR_Y, 340],
    ['props', 'tv', HELP_DESK.x, 250, 132],
    ['props', 'help-desk', HELP_DESK.x, FLOOR_Y + 6, 120],
    ['props', 'coffee-cart', COFFEE.x, FLOOR_Y + 6, 118],
    ['props', 'drive-cart', 960, FLOOR_Y + 6, 106],
    ['props', 'boxes', 2720, FLOOR_Y + 8, 100],
    ['props', 'pizza', 960, FLOOR_Y - 98, 26],
  ],
  front: [],
};
