// Evidence-based plot tags. A tag is returned only when its explicit phrase is present
// in the Shikimori synopsis; no model-generated or inferred labels are published.
export const PLOT_TAGS=[
 {id:"reincarnation",label:"Перерождение",pattern:/(перерожд\w*|реинкарнац\w*|reincarnat\w*|reborn)/i},
 {id:"isekai",label:"Попаданец",pattern:/(попада\w* в (?:другой|иной) мир|перенес\w* в (?:другой|иной) мир|оказыва\w* в (?:другом|ином) мире|transported to another world|isekai)/i},
 {id:"magic-academy",label:"Магическая академия",pattern:/(магическ\w* академ\w*|академ\w* маги\w*|magic academy|academy of magic)/i},
 {id:"hidden-power",label:"Скрывает свою силу",pattern:/(скрыва\w* (?:свою )?(?:силу|способност\w*)|притворя\w* слаб\w*|conceal\w* (?:his|her|their) power|hide\w* (?:his|her|their) (?:power|abilities))/i},
 {id:"training",label:"Тренировки и развитие",pattern:/(тренир\w*|тренировк\w*|training|train\w* to become stronger)/i},
 {id:"revenge",label:"Месть",pattern:/(мест\w*|отомст\w*|revenge|vengeance)/i},
 {id:"growth",label:"Постепенное развитие героя",pattern:/(становит\w* сильнее|от слаб\w* к сильн\w*|grow\w* stronger|gradual\w* growth)/i},
 {id:"overpowered-start",label:"Имба с первой серии",pattern:/(с самого начала (?:обладал|обладает) (?:огромной )?силой|с первой серии (?:он )?(?:сильн|непобедим)|overpowered from the start|powerful from the beginning)/i}
];

export function findPlotTags(anime){
 const synopsis=String(anime&& (anime.d||anime.description||anime.synopsis)||"").replace(/<[^>]*>/g," ").replace(/&nbsp;/gi," ");
 if(!synopsis.trim())return [];
 return PLOT_TAGS.flatMap(tag=>{
  const match=tag.pattern.exec(synopsis);
  if(!match)return [];
  const start=Math.max(0,match.index-65),end=Math.min(synopsis.length,match.index+match[0].length+65);
  return [{id:tag.id,label:tag.label,confidence:"high",source:"Shikimori synopsis",evidence:synopsis.slice(start,end).trim()}];
 });
}

export function hasPlotTag(anime,tagId){
 return findPlotTags(anime).some(tag=>tag.id===tagId);
}
