// Catalog page shell. Data fetching, filters and pagination remain in the app controller.
function selectHtml(id,label,current,options,all){
 return '<label>'+label+'<select id="'+id+'">'+(all?'<option value="">'+all+'</option>':"")+options.map(option=>'<option value="'+option[0]+'"'+(current==option[0]?" selected":"")+'>'+option[1]+'</option>').join("")+'</select></label>';
}

export function renderCatalogPage({app,filters,escapeHtml,genreOptions,genreLabels,yearOptions,statusOptions,formatOptions,sortOptions}){
 app.innerHTML='<div class="catalog-heading"><div><div class="eyebrow">Каталог Shikimori</div><h1>Каталог аниме</h1><p>Данные и русские названия — Shikimori. Постеры загружаются только из AniList.</p></div><div class="catalog-count"><b>SHIKIMORI</b><span>каталог</span></div></div>'+
 '<div class="catalog-tools"><label class="catalog-search-label">Поиск по названию<input id="cs" type="search" value="'+escapeHtml(filters.q||'')+'" placeholder="Например, Наруто или Frieren…" autocomplete="off"></label>'+
 '<div class="catalog-selects">'+selectHtml("cf-g","Жанр",filters.g,genreOptions.map(g=>[g,genreLabels[g]||g]),"Все жанры")+
 selectHtml("cf-y","Год",filters.y,yearOptions,"Любой год")+
 selectHtml("cf-st","Статус",filters.st,statusOptions,"Любой статус")+
 selectHtml("cf-f","Формат",filters.f,formatOptions,"Любой формат")+
 selectHtml("cf-o","Сортировка",filters.o,sortOptions)+'</div></div>'+
 '<div class="results-line"><b id="cc">Загрузка каталога…</b><span>Данные: Shikimori · постеры: AniList</span></div>'+
 '<div class="row" id="cr"></div><button id="more" class="btn ghost" type="button" data-xr="1">Загрузить каталог</button>';
}
