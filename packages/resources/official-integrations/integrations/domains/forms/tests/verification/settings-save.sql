-- Run inside a transaction against a local Forms installation; the caller rolls back.
do $$
declare
    resource jsonb;
    before_definition jsonb;
    published jsonb;
    form_id bigint;
    owned_key text := 'quality-settings-' || replace(gen_random_uuid()::text, '-', '');
    initial jsonb := '{"schemaVersion":1,"title":"Original","steps":[{"id":"details","title":"Details","fields":[{"key":"name","label":"Name","type":"text"}]}]}';
begin
    resource := forms.save_form_settings(null, owned_key, 'Original', 'Description', 'public', initial, 'quality');
    form_id := (resource ->> 'id')::bigint;
    perform forms.publish_form(owned_key, 'quality');
    select v.definition into published from forms.form_versions v where v.form_id = (resource ->> 'id')::bigint;
    -- Simulate a newer builder edit than the metadata page has seen.
    update forms.forms set draft_definition = jsonb_set(draft_definition, '{successMessage}', '"New builder message"')
    where id = form_id;
    select draft_definition into before_definition from forms.forms where id = form_id;
    resource := forms.save_form_settings(form_id, 'must-not-rename', 'Updated', '', 'authenticated', '{}', 'quality');
    if resource ->> 'key' <> owned_key or resource ->> 'title' <> 'Updated'
        or resource ->> 'accessMode' <> 'authenticated'
        or resource -> 'draftDefinition' <> jsonb_set(before_definition, '{title}', '"Updated"') then
        raise exception 'Settings changed the builder definition or stable identity';
    end if;
    if (select v.definition from forms.form_versions v where v.form_id = (resource ->> 'id')::bigint) <> published then
        raise exception 'Settings changed the published version';
    end if;
    begin
        perform forms.save_form_settings(null, owned_key, 'Duplicate', '', 'public', initial, 'quality');
        raise exception 'Duplicate creation unexpectedly succeeded';
    exception when unique_violation then null;
    end;
    begin
        perform forms.save_form_settings(-1, null, 'Missing', '', 'public', initial, 'quality');
        raise exception 'Missing update unexpectedly succeeded';
    exception when raise_exception then
        if sqlerrm <> 'not_found: form does not exist' then raise; end if;
    end;
    if has_function_privilege('anon', 'forms.save_form_settings(bigint,text,text,text,text,jsonb,text)', 'EXECUTE')
        or has_function_privilege('authenticated', 'forms.save_form_settings(bigint,text,text,text,text,jsonb,text)', 'EXECUTE') then
        raise exception 'Settings operation is publicly executable';
    end if;
end;
$$;
