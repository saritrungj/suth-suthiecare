function parse(value) {
  if (typeof value === 'string') return JSON.parse(value);
  return value || {};
}
function readWorkspace(row, organizationId) {
  const charts = parse(row?.active_charts);
  let workspace;
  if (charts.version === 2 && charts.organizations) workspace=charts.organizations[String(organizationId)];
  // Legacy settings belong only to the organization recorded on the row.
  else workspace=row && Number(row.organization_id) === Number(organizationId)
    ? {last_selected_form_id:row.last_selected_form_id,active_charts:charts}
    : {last_selected_form_id:null,active_charts:{}};
  if(!workspace)return {last_selected_form_id:null,active_charts:{}};
  return {...workspace,active_charts:Object.fromEntries(Object.entries(parse(workspace.active_charts)).filter(([,list])=>Array.isArray(list)).map(([id,list])=>[id,list.map(({data,...definition})=>definition)]))};
}
function mergeWorkspace(row, organizationId, workspace) {
  const current = parse(row?.active_charts);
  const organizations = current.version === 2 ? {...current.organizations} : {};
  if (row?.organization_id && current.version !== 2) organizations[String(row.organization_id)] = readWorkspace(row,row.organization_id);
  organizations[String(organizationId)] = workspace;
  return {version:2,organizations};
}
module.exports={readWorkspace,mergeWorkspace};
