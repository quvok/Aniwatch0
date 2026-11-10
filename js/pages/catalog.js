// Catalog page shell. Data fetching, filters and pagination remain in the app controller.
function selectHtml(id,label,current,options,all){
 return '<label>'+label+'<select id="'+id+'">'+(all?'<option value="">'+all+'</option>':"")+options.map(option=>'<option value="'+option[0]+'"'+(current==option[0]?" selected":"")+'>'+option[1]+'</option>').join("")+'</select></label>';
}

export function renderCatalogPage({app,filters,escapeHtml,genreOptions,genreLabels,yearOptions,seasonOptions,statusOptions,formatOptions,sortOptions,ratingOptions,plotTagOptions=[]}){
 app.innerHTML='<div class="catalog-heading"><div><div class="eyebrow">ВСЁ АНИМЕ В ОДНОМ МЕСТЕ</div><h1>Каталог аниме</h1><p>Ищи аниме по названию, жанру, году и другим параметрам.</p></div></div>'+
 '<div class="catalog-tools"><label>Поиск по названию<input id="cs" type="search" value="'+escapeHtml(filters.q||'')+'" placeholder="Например, Наруто или Frieren…" autocomplete="off"></label><div class="catalog-selects">'+selectHtml("cf-g","Жанр",filters.g,genreOptions.map(g=>[g,genreLabels[g]||g]),"Все жанры")+
 selectHtml("cf-y","Год",filters.y,yearOptions,"Любой год")+
 selectHtml("cf-season","Сезон",filters.season,seasonOptions,"Любой сезон")+
 selectHtml("cf-st","Статус",filters.st,statusOptions,"Любой статус")+
 selectHtml("cf-f","Формат",filters.f,formatOptions,"Любой формат")+
 selectHtml("cf-r","Рейтинг от",filters.minScore,ratingOptions,"Любой рейтинг")+\n selectHtml("cf-tag","Сюжетная метка",filters.tag,plotTagOptions,"Все метки")+
 selectHtml("cf-o","Сортировка",filters.o,sortOptions)+'</div></div>'+
 '<p class="catalog-tag-note">Сюжетные метки ставятся только при явном совпадении с текстом описания Shikimori. Неподтверждённые догадки не используются.</p><div class="results-line"><b id="cc">Загрузка каталога…</b><button class="text-link" type="button" data-cf-reset>Сбросить фильтры</button></div>'+
 '<div class="row" id="cr"></div><button id="more" class="btn ghost" type="button" data-xr="1">Загрузить каталог</button>';
}
