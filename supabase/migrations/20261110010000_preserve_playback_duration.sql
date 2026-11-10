-- Keep real media duration when a newer playback snapshot wins a conflict.
create or replace function public.guard_user_library_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_history jsonb;
  new_history jsonb;
  old_progress_at numeric;
  new_progress_at numeric;
  old_episodes jsonb;
  new_episodes jsonb;
  merged_episodes jsonb;
begin
  if tg_op = 'UPDATE' then
    old_history := case when jsonb_typeof(old.history) = 'object' then old.history else '{}'::jsonb end;
    new_history := case when jsonb_typeof(new.history) = 'object' then new.history else '{}'::jsonb end;

    old_progress_at := case when old_history->>'at' ~ '^-?[0-9]+([.][0-9]+)?$' then (old_history->>'at')::numeric else null end;
    new_progress_at := case when new_history->>'at' ~ '^-?[0-9]+([.][0-9]+)?$' then (new_history->>'at')::numeric else null end;

    new_history := old_history || new_history;
    if old_progress_at is not null and (new_progress_at is null or old_progress_at > new_progress_at) then
      new_history := new_history || jsonb_strip_nulls(jsonb_build_object(
        'ep', old_history->'ep',
        't', old_history->'t',
        'duration', old_history->'duration',
        'at', old_history->'at',
        'speed', old_history->'speed'
      ));
    end if;

    old_episodes := case when jsonb_typeof(old_history->'watchedEpisodes') = 'array' then old_history->'watchedEpisodes' else '[]'::jsonb end;
    new_episodes := case when jsonb_typeof(new_history->'watchedEpisodes') = 'array' then new_history->'watchedEpisodes' else '[]'::jsonb end;

    if jsonb_typeof(old_history->'watchedEpisodes') = 'array' or jsonb_typeof(new_history->'watchedEpisodes') = 'array' then
      select coalesce(jsonb_agg(to_jsonb(episode) order by episode), '[]'::jsonb)
        into merged_episodes
      from (
        select distinct value::integer as episode
        from jsonb_array_elements_text(old_episodes || new_episodes) as item(value)
        where value ~ '^[0-9]{1,9}$' and value::integer > 0
      ) as valid_episodes;
      new_history := new_history || jsonb_build_object('watchedEpisodes', merged_episodes);
    end if;

    new.history := new_history;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_user_library_progress() from public, anon, authenticated;
