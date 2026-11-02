// Oogiri Night prompts for the Green Car (shared/src/greenCar.ts; design: the project's
// n3-coverage/green-car/design.md). Every prompt's blank sits inside an N4 or N3 frame, so the
// finished line carries it: N4 ＿たら and ＿ば (4.5), ＿ように なる and ＿ことに する (4.12); N3 ＿わりに,
// ＿くせに and ＿に しては (3.4), ＿と したら (3.5), ＿っぽい and ＿なんて (3.11). The blank takes a noun, so
// tiles fit. ＿くせに, ＿わりに and ＿に しては are aimed at yōkai, animals, props, events or Pon, never at a
// player. Kids prompts (no dating, drinking, money or work) and Cheeky ones are dealt first in their
// rooms; the untagged ones are kid-safe and go to every Green Car room. Never dealt outside the
// Green Car (deal.ts). All draft until a fluent speaker (and Ladi, for taste) checks them.

import type { JpText, OogiriPrompt, PromptAudience } from '../types.js';

type GcLevel = 'n4' | 'n3';

const jp = (kana: string, en: string): JpText => ({ text: kana, kana, en });

function gc(
  id: string,
  packId: string,
  audience: PromptAudience | null,
  level: GcLevel,
  frame: string,
  prompt: [string, string],
  fit: string[],
  swerve: string[],
  example: [string, string],
  pattern: string,
): OogiriPrompt {
  const version = jp(prompt[0], prompt[1]);
  return {
    id: `gc.${id}`,
    packId,
    round: 'head-to-head',
    ...(audience ? { audiences: [audience] } : {}),
    versions: { n4: version, n3: version },
    fitTileIds: fit,
    swerveTileIds: swerve,
    exampleAnswer: jp(prompt[0].replace('＿＿＿', example[0]), example[1]),
    pattern,
    greenCar: true,
    level,
    frames: [frame],
    status: 'draft',
  };
}

const TARA = '＿たら: when / if ___ happens (たら after the past form).';
const BA = '＿ば: if ___ (the ば form: あれば, こなければ).';
const YOUNI = '＿ように なる: has come to ___ (a change over time).';
const KOTONI = '＿ことに する: decide to ___.';
const NISHITEWA = '＿に しては: for a ___ (surprising for what it is).';
const KUSENI = '＿くせに: even though ___ (and that annoys me).';
const WARINI = '＿わりに: considering ___ (more or less than you would think).';
const TOSHITARA = '＿と したら: supposing ___.';
const PPOI = '＿っぽい: ___-ish, kind of like ___.';
const NANTE = '＿なんて: ___? (dismissive or surprised)';

export const greenCarPrompts: OogiriPrompt[] = [
  // ---- Kids: school, pets, siblings, yōkai ----
  gc('kids.robot-teacher', 'food', 'kids', 'n4', 'tara',
    ['せんせいが ロボットに なったら、きゅうしょくは ＿＿＿です。', 'If our teacher turned into a robot, school lunch would be ___.'],
    ['food.curry', 'food.udon', 'food.pan', 'food.onigiri'], ['food.choco-curry', 'food.singing-onigiri', 'food.old-bread'],
    ['チョコレートカレー', 'If our teacher turned into a robot, school lunch would be chocolate curry.'], TARA),
  gc('kids.brother-cat', 'family', 'kids', 'n4', 'tara',
    ['おにいちゃんが ねこに なったら、まいにち ＿＿＿で あそびます。', 'If my big brother turned into a cat, he would play with ___ every day.'],
    ['family.terebi', 'family.sumaho', 'family.reizouko'], ['family.danbooru', 'family.robotto-soujiki', 'food.giant-octopus'],
    ['ダンボール', 'If my big brother turned into a cat, he would play with a cardboard box every day.'], TARA),
  gc('kids.no-homework', 'family', 'kids', 'n4', 'ba',
    ['＿＿＿が あれば、しゅくだいは いりません。', "If I had ___, I wouldn't need homework."],
    ['family.sumaho', 'family.robotto-soujiki', 'family.tomodachi'], ['family.ninja', 'family.uchuujin', 'family.kappa'],
    ['にんじゃ', "If I had a ninja, I wouldn't need homework."], BA),
  gc('kids.hamster-eats', 'food', 'kids', 'n4', 'you-ni-naru',
    ['うちの ハムスターは ＿＿＿を たべるように なりました。', 'Our hamster has started eating ___.'],
    ['food.onigiri', 'food.cake', 'food.sushi', 'food.pan'], ['food.natto-ice-cream', 'food.dancing-ebi-fry', 'food.bucket-pudding'],
    ['バケツプリン', 'Our hamster has started eating bucket-sized pudding.'], YOUNI),
  gc('kids.walk-with', 'family', 'kids', 'n4', 'koto-ni-suru',
    ['きょうから まいにち ＿＿＿と さんぽする ことに します。', "From today I've decided to go for a walk with ___ every day."],
    ['family.inu', 'family.neko', 'family.hamusutaa', 'family.tomodachi'], ['family.pengin', 'family.zonbi', 'family.kappa'],
    ['ペンギン', "From today I've decided to go for a walk with a penguin every day."], KOTONI),
  gc('kids.for-a-cat', 'family', 'kids', 'n3', 'ni-shite-wa',
    ['ねこに しては、＿＿＿が すきすぎる。', 'For a cat, it likes ___ way too much.'],
    ['food.natto', 'food.ramen', 'food.curry', 'food.okashi'], ['food.natto-ice-cream', 'food.choco-curry', 'food.ghost-ramen'],
    ['なっとう', 'For a cat, it likes natto way too much.'], NISHITEWA),
  gc('kids.scared-ghost', 'family', 'kids', 'n3', 'kuse-ni',
    ['おばけの くせに、＿＿＿が こわいんだって。', "It's a ghost, and yet it's scared of ___, apparently."],
    ['family.inu', 'family.neko', 'family.ofuro', 'family.shukudai'], ['family.zonbi', 'family.robotto-soujiki', 'family.hamusutaa'],
    ['ハムスター', "It's a ghost, and yet it's scared of hamsters, apparently."], KUSENI),
  gc('kids.big-onigiri', 'food', 'kids', 'n3', 'wari-ni',
    ['あの おにぎり、おおきい わりに なかみは ＿＿＿だけ。', "That rice ball's huge, and all that's inside is ___."],
    ['food.sakana', 'food.niku', 'food.natto'], ['food.giant-octopus', 'food.studio-fridge', 'food.old-bread'],
    ['おおきな タコ', "That rice ball's huge, and all that's inside is a giant octopus."], WARINI),
  gc('kids.lunch-taste', 'food', 'kids', 'n3', 'ppoi',
    ['きょうの きゅうしょく、なんか ＿＿＿っぽい あじが する。', "Today's school lunch tastes kind of like ___."],
    ['food.curry', 'food.natto', 'food.cake', 'food.ramen'], ['food.choco-curry', 'food.natto-ice-cream', 'food.old-bread'],
    ['なっとう', "Today's school lunch tastes kind of like natto."], PPOI),
  gc('kids.not-scary', 'family', 'kids', 'n3', 'nante',
    ['＿＿＿なんて、ぜんぜん こわく ないよ。', "___? Not scary at all."],
    ['family.obake', 'family.zonbi', 'family.kappa'], ['family.hamusutaa', 'family.robotto-soujiki', 'family.pengin'],
    ['ゾンビ', 'Zombies? Not scary at all.'], NANTE),
  gc('kids.ghost-pon', 'food', 'kids', 'n3', 'to-shitara',
    ['もし ポンが ゆうれいだと したら、すきな たべものは ＿＿＿だろうね。', "If Pon were a ghost, his favourite food would be ___, I bet."],
    ['food.ramen', 'food.onigiri', 'food.okashi'], ['food.ghost-ramen', 'food.old-bread', 'food.singing-onigiri'],
    ['ゆうれいの ラーメン', "If Pon were a ghost, his favourite food would be ghost ramen, I bet."], TOSHITARA),

  // ---- Every audience (kid-safe) ----
  gc('tanuki-clerk', 'food', null, 'n4', 'tara',
    ['たぬきが てんいんに なったら、コンビニで ＿＿＿を うります。', 'If a tanuki worked at the konbini, it would sell ___.'],
    ['food.onigiri', 'food.bento', 'food.okashi'], ['food.old-bread', 'food.cat-chef', 'food.singing-onigiri'],
    ['うたう おにぎり', 'If a tanuki worked at the konbini, it would sell singing rice balls.'], TARA),
  gc('ryokan-first', 'travel', null, 'n4', 'tara',
    ['りょかんに ついたら、まず ＿＿＿に はいります。', 'When we get to the ryokan, the first thing we get into is ___.'],
    ['travel.onsen', 'travel.futon', 'travel.heya'], ['travel.yuufoo', 'travel.chouchin', 'family.danbooru'],
    ['ダンボール', 'When we get to the ryokan, the first thing we get into is a cardboard box.'], TARA),
  gc('no-train', 'travel', null, 'n4', 'ba',
    ['この きっぷが あれば、＿＿＿にも のれます。', 'With this ticket, you can even ride ___.'],
    ['travel.takushii', 'travel.densha'], ['travel.tako', 'travel.yuufoo', 'travel.pengin-ekichou'],
    ['ユーフォー', 'With this ticket, you can even ride a UFO.'], BA),
  gc('grandpa-uses', 'family', null, 'n4', 'you-ni-naru',
    ['おじいちゃんは さいきん ＿＿＿を つかえるように なりました。', 'Grandpa has recently learned to use ___.'],
    ['family.sumaho', 'family.terebi', 'family.robotto-soujiki'], ['family.ninja', 'travel.yuufoo', 'family.danbooru'],
    ['ユーフォー', 'Grandpa has recently learned to use a UFO.'], YOUNI),
  gc('summer-trip', 'travel', null, 'n4', 'koto-ni-suru',
    ['ことしの なつやすみは ＿＿＿に いく ことに しました。', "We've decided to go to ___ for the summer holidays this year."],
    ['travel.onsen', 'travel.ryokan', 'travel.hoteru'], ['travel.yuufoo', 'travel.obake-densha', 'food.studio-fridge'],
    ['スタジオの れいぞうこ', "We've decided to go to the studio's fridge for the summer holidays this year."], KOTONI),
  gc('for-a-penguin', 'food', null, 'n3', 'ni-shite-wa',
    ['ペンギンに しては、＿＿＿が すきすぎる。', 'For a penguin, it likes ___ way too much.'],
    ['food.ramen', 'food.curry', 'travel.onsen'], ['food.natto-ice-cream', 'family.danbooru', 'food.choco-curry'],
    ['おんせん', 'For a penguin, it likes hot springs way too much.'], NISHITEWA),
  gc('pon-tanuki', 'family', null, 'n3', 'kuse-ni',
    ['ポンは たぬきの くせに、＿＿＿に ばけられない。', "Pon's a tanuki, and he still can't turn into ___."],
    ['family.neko', 'family.inu', 'travel.kasa'], ['family.aidoru', 'family.ousama', 'family.ninja'],
    ['アイドル', "Pon's a tanuki, and he still can't turn into a pop idol."], KUSENI),
  gc('old-ryokan', 'travel', null, 'n3', 'wari-ni',
    ['この りょかん、ふるい わりに ＿＿＿が ある。', 'This ryokan has ___, considering how old it is.'],
    ['travel.onsen', 'family.terebi', 'travel.futon'], ['travel.yuufoo', 'family.robotto-soujiki', 'travel.robotto'],
    ['ロボット', 'This ryokan has a robot, considering how old it is.'], WARINI),
  gc('cloud-shape', 'family', null, 'n3', 'ppoi',
    ['あの くも、＿＿＿っぽい かたちだね。', "That cloud's kind of shaped like ___."],
    ['family.neko', 'family.inu', 'food.onigiri'], ['food.giant-octopus', 'family.pengin', 'travel.yuufoo'],
    ['ペンギン', "That cloud's kind of shaped like a penguin."], PPOI),
  gc('winter-morning', 'travel', null, 'n3', 'nante',
    ['ふゆの あさに ＿＿＿なんて、むりだよ。', '___ on a winter morning? No way.'],
    ['food.ice-cream', 'travel.aisukuriimu', 'family.ofuro'], ['travel.obake-densha', 'food.natto-ice-cream', 'travel.tako'],
    ['なっとうアイス', 'Natto ice cream on a winter morning? No way.'], NANTE),
  gc('robot-staff', 'travel', null, 'n3', 'to-shitara',
    ['もし えきいんさんが ロボットだと したら、＿＿＿で うごいて いる。', 'If the station staff were robots, they would run on ___.'],
    ['food.coffee', 'food.mizu', 'food.ocha'], ['food.natto', 'food.choco-curry', 'food.bucket-pudding'],
    ['チョコレートカレー', 'If the station staff were robots, they would run on chocolate curry.'], TOSHITARA),
  gc('one-spell', 'family', null, 'n3', 'to-shitara',
    ['まほうが ひとつ つかえると したら、＿＿＿を だしたい。', 'If I could cast just one spell, I would conjure up ___.'],
    ['food.cake', 'travel.kasa', 'family.sumaho'], ['food.bucket-pudding', 'family.ninja', 'travel.yuufoo'],
    ['バケツプリン', 'If I could cast just one spell, I would conjure up a bucket-sized pudding.'], TOSHITARA),

  // ---- Cheeky: grown-up, never explicit ----
  gc('cheeky.bonus', 'food', 'cheeky', 'n4', 'tara',
    ['ボーナスが でたら、まず ＿＿＿を かいます。', 'When my bonus comes in, the first thing I buy is ___.'],
    ['food.sushi', 'food.beer', 'food.niku'], ['food.man-yen-onigiri', 'food.studio-fridge', 'family.robotto-soujiki'],
    ['いちまんえんの おにぎり', 'When my bonus comes in, the first thing I buy is a 10,000-yen rice ball.'], TARA),
  gc('cheeky.boss-drunk', 'family', 'cheeky', 'n4', 'tara',
    ['ぶちょうは よっぱらったら、かならず ＿＿＿の はなしを します。', 'Whenever the boss gets drunk, he always talks about ___.'],
    ['family.shigoto', 'food.beer', 'family.kazoku'], ['family.uchuujin', 'family.kappa', 'food.giant-octopus'],
    ['カッパ', 'Whenever the boss gets drunk, he always talks about kappa.'], TARA),
  gc('cheeky.popular', 'family', 'cheeky', 'n4', 'ba',
    ['＿＿＿を やめれば、もう すこし もてるのに。', "If I gave up ___, I'd be a bit more popular."],
    ['family.shigoto', 'food.natto', 'family.sumaho'], ['family.robotto-soujiki', 'family.zonbi', 'food.grandmas-sauce'],
    ['おばあちゃんの ひみつの ソース', "If I gave up grandma's secret sauce, I'd be a bit more popular."], BA),
  gc('cheeky.order-now', 'food', 'cheeky', 'n4', 'you-ni-naru',
    ['さいきん、のみかいで ＿＿＿を たのむように なった。', "Lately I've started ordering ___ at drinking parties."],
    ['food.ocha', 'food.mizu', 'food.natto'], ['food.bucket-pudding', 'food.choco-curry', 'food.natto-ice-cream'],
    ['おちゃ', "Lately I've started ordering tea at drinking parties."], YOUNI),
  gc('cheeky.quit', 'food', 'cheeky', 'n4', 'koto-ni-suru',
    ['らいげつから ＿＿＿を やめる ことに しました。…たぶん。', "From next month I've decided to give up ___. …Probably."],
    ['food.beer', 'food.coffee', 'food.ramen'], ['food.cake', 'family.sumaho', 'food.takoyaki'],
    ['ビール', "From next month I've decided to give up beer. …Probably."], KOTONI),
  gc('cheeky.date-talk', 'family', 'cheeky', 'n3', 'wari-ni',
    ['デートの わりに、＿＿＿の はなししか しなかった。', 'For a date, all we talked about was ___.'],
    ['family.shigoto', 'family.neko', 'family.kazoku'], ['family.kappa', 'family.uchuujin', 'food.natto'],
    ['うちゅうじん', 'For a date, all we talked about was aliens.'], WARINI),
  gc('cheeky.if-party', 'food', 'cheeky', 'n3', 'to-shitara',
    ['こんやが のみかいだと したら、かんぱいは ＿＿＿で しよう。', "If tonight's a drinking party, let's toast with ___."],
    ['food.beer', 'food.ocha', 'food.juice'], ['food.natto', 'food.grandmas-sauce', 'food.bucket-pudding'],
    ['なっとう', "If tonight's a drinking party, let's toast with natto."], TOSHITARA),
  gc('cheeky.pon-host', 'food', 'cheeky', 'n3', 'kuse-ni',
    ['ポンは ホストの くせに、＿＿＿の はなしばかり する。', "Pon's the host, and all he ever talks about is ___."],
    ['food.beer', 'food.ramen', 'family.shigoto'], ['food.giant-octopus', 'family.aidoru', 'food.ghost-ramen'],
    ['ゆうれいの ラーメン', "Pon's the host, and all he ever talks about is ghost ramen."], KUSENI),
  gc('cheeky.first-date', 'family', 'cheeky', 'n3', 'ni-shite-wa',
    ['はじめての デートに しては、＿＿＿は ちょっと はやすぎない？', "For a first date, isn't ___ a bit fast?"],
    ['family.kazoku', 'family.ie', 'travel.onsen'], ['family.ousama', 'family.robotto-soujiki', 'family.zonbi'],
    ['かぞく', "For a first date, isn't meeting the family a bit fast?"], NISHITEWA),
  gc('cheeky.boss-ish', 'family', 'cheeky', 'n3', 'ppoi',
    ['さいきんの ぶちょう、なんか ＿＿＿っぽい。', "The boss has been kind of ___-ish lately."],
    ['family.ninja', 'family.aidoru', 'family.shachou'], ['family.zonbi', 'family.kappa', 'family.pengin'],
    ['ゾンビ', 'The boss has been kind of zombie-ish lately.'], PPOI),
  gc('cheeky.monday', 'family', 'cheeky', 'n3', 'nante',
    ['げつようびの あさから ＿＿＿なんて、だれが きめたの？', '___ first thing Monday morning? Who decided that?'],
    ['family.shigoto', 'food.coffee', 'food.natto'], ['family.zonbi', 'food.studio-fridge', 'family.kappa'],
    ['ゾンビ', 'Zombies first thing Monday morning? Who decided that?'], NANTE),
];
