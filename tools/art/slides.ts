// Draws Happyōkai!'s slide pictures with PixelLab, in the same style as the Oogiri Photo Caption pictures.
//
//   PIXELLAB_API_KEY=... npx tsx tools/art/slides.ts [slideId ...]
//
// Writes stage/assets/slides/<id>.png (320×240, the projector screen's 4:3) for every slide below whose
// picture is missing, or only the ids given. Every picture should be funny, or clearly Japanese, with the
// word covered. Look at every result before committing: redraw any with text in it or the wrong subject
// (pass a different seed with SEED=...).

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const STYLE =
  'Pixel art scene for a Japanese late-night TV comedy game, like a photo projected on a slide, warm colours, clear readable silhouettes, ' +
  'expressive cartoon characters, simple background, no text, no letters, no writing. ';

/** Slide id → what the picture shows. Ids match shared/src/modes/happyokai/content.ts. */
export const SLIDE_PROMPTS: Record<string, string> = {
  // Everyday Japan, played straight
  omikuji: 'A small Japanese shrine with paper fortune slips tied in rows on a wooden rack, a young woman holding a fortune slip with a surprised face.',
  jihanki: 'A glowing Japanese drink vending machine alone on a snowy street at night, warm light on the snow.',
  'rush-hour': 'A packed Tokyo morning commuter train, office workers squashed together holding straps, one man asleep standing up.',
  shinkansen: 'A white Japanese bullet train speeding past with Mount Fuji behind it, blue sky.',
  kotatsu: 'A low kotatsu table covered with a thick orange quilt in a tatami room, a bowl of mandarin oranges on top, a fat cat asleep with only its head sticking out from under the quilt.',
  ekiben: 'A Japanese station bento box open on a bullet train tray table, window behind showing countryside and Mount Fuji.',
  sakura: 'A picnic on a blue sheet under pink cherry blossom trees in a park, friends sitting with snacks.',
  oden: 'Close-up of a steaming square pot of oden at a convenience store counter: boiled eggs, white daikon radish rounds and fish cakes in brown broth, a ladle.',
  sento: 'An empty Japanese public bath house with a big Mount Fuji mural on the tiled wall, wooden buckets stacked.',
  ramen: 'A steaming bowl of ramen with egg, pork and nori on a wooden counter of a small ramen shop.',
  sushi: 'A conveyor belt sushi restaurant, colourful plates of sushi moving along the belt.',
  curry: 'A plate of Japanese curry rice: white rice on one side, brown curry sauce with potato and carrot chunks on the other, a spoon, steaming, on a wooden table.',
  natto: 'Close-up of a small bowl of sticky brown natto beans lifted with chopsticks, long sticky strings stretching up, a bowl of rice beside it.',
  school: 'A Japanese school building entrance with cherry trees, a red school backpack on the steps.',
  konbini: 'A brightly lit Japanese convenience store at night seen from outside, glowing windows on a dark street.',
  onsen: 'An outdoor rock hot spring bath in the snow, steam rising, a wooden fence and pine trees.',
  fuji: 'Mount Fuji with snow on top at sunrise, a calm lake in front reflecting it.',
  sea: 'A sunny Japanese beach with colourful parasols, a watermelon on a towel, blue sea.',
  shiba: 'A shiba inu dog sitting very proudly in front of a Japanese house, curled tail.',
  cat: 'A fat cat asleep on the warm bonnet of a small car in a Japanese street.',
  teacher: 'A teacher standing at a green chalkboard in a Japanese classroom, pointing with a long stick, rows of empty desks.',
  grandpa: 'An old man with a white beard at a wooden shogi board on a park bench, chin in hand, thinking very hard, shogi pieces on the board.',
  baby: 'A tiny baby asleep in a sling on a parent’s chest, a little hat.',
  umbrella: 'A rack of clear plastic umbrellas outside a shop in the rain, one bright red umbrella among them.',
  bicycle: 'A Japanese mother’s bicycle with a child seat on the back and a shopping basket full of leeks.',
  money: 'Japanese yen: silver and gold coins (some with a hole in the middle) and paper banknotes on a small blue cash tray at a shop counter.',
  // Ridiculous
  grandma: 'A tiny grandmother in a cardigan doing a skateboard kickflip in a skate park, totally calm, teenagers staring.',
  sock: 'A single striped sock displayed on a marble museum pedestal under a dramatic spotlight, velvet rope in front.',
  'cat-boss': 'A cat in a tiny necktie sitting on a robot vacuum in a living room, staring at the camera like a company president.',
  kappa: 'A kappa yokai, a green turtle-like creature with a bird beak, a shell on its back and a water plate on its head, folding laundry at a coin laundromat with a very serious face.',
  tanuki: 'A round tanuki raccoon dog stuck inside a capsule toy vending machine, pressing its face against the plastic, coins on the floor.',
  ghost: 'A cute white sheet ghost taking a selfie with a phone in front of a red shrine gate, peace sign.',
  dragon: 'A small chubby dragon toasting a rice cake on a stick with its fire breath, sitting by a kotatsu.',
  octopus: 'A nervous orange octopus working behind a takoyaki street stall, sweating, flipping takoyaki balls.',
  pudding: 'A gigantic wobbling custard pudding with caramel on top, bigger than the man standing next to it holding a spoon.',
  ufo: 'A flying saucer beaming a Japanese vending machine up into the night sky with a green light, a cat watching.',
  dinosaur: 'A green dinosaur standing on a crowded commuter train holding a strap, office workers squeezed around it.',
  penguin: 'A penguin relaxing in an outdoor hot spring bath with a small towel on its head, eyes closed.',
  robot: 'A robot in a suit bowing much too deeply, its head touching the floor, in front of a surprised businessman.',
  alien: 'A green alien in a convenience store holding a rice ball, confused by the plastic wrapper, the clerk staring.',
  pants: 'A pair of giant white underpants flying from a tall pole like a carp streamer, blue sky, a family looking up.',
  toilet: 'A Japanese high-tech toilet with a huge control panel of many buttons, water spraying up, a man in panic.',
  panda: 'A big panda squeezed into a tiny yellow kei car, its arms out of the windows.',
  daruma: 'A red daruma doll with one eye painted in, winking, sitting on a shelf.',
  mochi: 'A grandfather stretching a long piece of white mochi rice cake between two chopsticks, the stretchy mochi reaching across the whole room like a rope, his family laughing.',
  pigeon: 'A pigeon wearing a train conductor’s hat standing on a station platform, very serious.',
  fridge: 'An open fridge with every shelf full of only mayonnaise bottles, light shining out.',
  remote: 'Close-up inside an open fridge: a black TV remote control on a shelf next to a milk carton and eggs, cold blue fridge light.',
  // Grown-up
  office: 'A Japanese office at night, one tired worker still at a desk under a single desk lamp, towers of paper, dark windows behind.',
  karaoke: 'A company boss in a karaoke room singing into a microphone with his necktie tied round his forehead like a headband, coworkers clapping politely, disco lights.',
  ring: 'A diamond ring falling into a bowl of ramen during a proposal, the man on one knee in shock.',
  balcony: 'A salaryman in his underpants and socks locked out on an apartment balcony at night, knocking on the glass door.',
  drunk: 'A drunk salaryman hugging a glowing vending machine at 3 a.m., his tie loose, a cat watching.',
  meeting: 'A company boss fast asleep with his head on the table at a meeting, a projector screen behind him, his staff staring at each other.',
  groom: 'A nervous groom in a tuxedo at a wedding reading his speech off the palm of his hand, guests watching.',
  'you-up': 'A phone lock screen glowing in a dark bedroom at 2 a.m. with a message bubble and a winking emoji, a person peeking from under the duvet.',
  beer: 'A Japanese izakaya table covered in empty beer mugs and edamame shells, a sleeping man at the end.',
  cv: 'A paper job application form on a desk with a photo of a dog in a suit glued on it, a pen beside it, only blank lines on the form.',
  'love-letter': 'A pink love letter with a heart sticker left on the wrong desk in an office, a confused old manager holding it.',
  heel: 'One red high heel shoe left alone on the seat of an empty last train at night.',
  'fish-photo': 'A man proudly holding up a huge fish on a boat, grinning, like a dating profile photo.',
  capsule: 'A capsule hotel wall of small sleeping pods, one salaryman’s legs sticking out of a pod.',
  // Cheeky from women's side
  bouquet: 'Close-up at a wedding: three bridesmaids in pastel dresses diving through the air like rugby players, arms stretched for a flying white bouquet, the bride laughing behind them.',
  joshikai: 'Four women friends at an izakaya table laughing hard, one showing the others a blurry photo of a man on her phone, the others pulling faces.',
  shuutome: 'Close-up: an old Japanese woman in a kimono wearing one white glove holds up her fingertip covered in grey dust in front of a nervous young wife.',
  makeup: 'Close-up of a woman on a packed commuter train calmly drawing perfect eyeliner with a small hand mirror while the train shakes, passengers squashed around her.',
  'mama-boy': 'A young man at a candlelit restaurant table happily talking to his mum on his phone, his girlfriend opposite with her arms folded, unimpressed.',
  'face-mask': 'A woman with a white sheet face mask over her whole face and a towel round her hair opening her front door, a delivery man holding a parcel jumping back in fright.',
  shopping: 'A woman marching out of a shop with twenty shopping bags on both arms, her boyfriend asleep on a bench outside holding her small handbag.',
  cake: 'A woman at midnight in front of an open fridge eating a whole strawberry cake straight from the box with a fork, a bathroom scale on the floor beside her.',
  // College life
  'all-nighter': 'A university student at 5 a.m. asleep face-down on a pile of textbooks, energy drink cans stacked into a tower, the sunrise outside the window.',
  'cup-noodle': 'A tiny student apartment kitchen with a whole wall of stacked instant cup noodles, a student proudly showing it off.',
  nomikai: 'A rowdy university club party in a tatami izakaya room: students cheering with beer mugs raised, one asleep on the table with a party hat on.',
  lecture: 'A university lecture hall where every student is fast asleep face-down on their desk, and the old professor at the blackboard is snoring too.',
  kigurumi: 'A student in a giant fried-chicken mascot costume handing out flyers in the pouring rain, looking miserable.',
  // Yakuza who really should not be yakuza
  'kid-boss': 'Close-up: a tiny seven-year-old girl boss in big black sunglasses and a red school backpack sitting on a playground slide like a throne, arms folded, with three small kids in sunglasses bowing deeply to her, dramatic.',
  'tea-yakuza': 'Tough yakuza in black suits and sunglasses kneeling very politely at a tea ceremony, sipping matcha with their little fingers raised.',
  'shiba-oyabun': 'A shiba inu dog in a dark suit and sunglasses sitting behind a huge wooden desk, tough men in suits bowing deeply to it.',
  'maid-yakuza': 'A scary scarred yakuza man in a frilly maid outfit serving a heart-decorated omelette rice at a cute maid cafe, the customers frozen.',
  hitokara: 'One man completely alone in a small karaoke room, on his knees singing with his eyes shut and a tambourine raised, disco lights, empty sofa.',
  // Chōchin-san's holiday photos (his running gag)
  'chochin-holiday-1': 'A completely dark, empty train station platform at night, almost black, one tiny distant light.',
  'chochin-holiday-2': 'A completely dark train station platform at night, almost black, with two glowing eyes in the darkness.',
  'chochin-holiday-3': 'A lit train station platform at night: a friendly round red paper lantern with a face, in the middle of a group of cute Japanese yokai (a one-eyed umbrella, a kappa, a fox, a tanuki), all posing for a group photo.',
};

const key = process.env.PIXELLAB_API_KEY;
if (!key) throw new Error('Set PIXELLAB_API_KEY.');
const seed = Number(process.env.SEED ?? 7);
const only = new Set(process.argv.slice(2));
const outDir = path.join(import.meta.dirname, '..', '..', 'stage', 'assets', 'slides');
mkdirSync(outDir, { recursive: true });

const ids = Object.keys(SLIDE_PROMPTS).filter((id) => (only.size ? only.has(id) : !existsSync(path.join(outDir, `${id}.png`))));
// Four at a time: PixelLab answers each in about 10–20 s.
for (let i = 0; i < ids.length; i += 4) {
  await Promise.all(
    ids.slice(i, i + 4).map(async (id) => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await fetch('https://api.pixellab.ai/v2/create-image-pixflux', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({ description: STYLE + SLIDE_PROMPTS[id], image_size: { width: 320, height: 240 }, text_guidance_scale: 8, view: 'side', seed }),
        });
        if (!res.ok) {
          console.error(`${id}: ${res.status} ${(await res.text()).slice(0, 200)}`);
          await new Promise((r) => setTimeout(r, 4000 * attempt));
          continue;
        }
        const { image } = (await res.json()) as { image: { base64: string } };
        writeFileSync(path.join(outDir, `${id}.png`), Buffer.from(image.base64.replace(/^data:[^,]+,/, ''), 'base64'));
        console.log('drew', id);
        return;
      }
    }),
  );
}
