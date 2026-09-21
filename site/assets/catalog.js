// Display order only: effort names do not imply equivalent levels across providers.
const effortOrder = ["low", "high", "max", "default", "未记录"];
export const effortOf = (item) => item.parameters?.reasoningEffort || "未记录";
export const providerOf = (item) => item.modelProvider || (item.kind === "demo" ? "站点演示" : "未记录");
export const identityOf = (item) => `${providerOf(item)} / ${item.model} / ${effortOf(item)}`;
const alphabetical = (a, b) => a.localeCompare(b, "zh-CN");
export function compareEfforts(a, b) {
  const rank = (value) => effortOrder.includes(value) ? effortOrder.indexOf(value) : effortOrder.length;
  return rank(a) - rank(b) || alphabetical(a, b);
}
const unique = (values) => [...new Set(values)].sort(alphabetical);
export function cascade(items, requested = {}) {
  const formal = items.filter((s) => s.kind !== "demo");
  const providers = unique(formal.map(providerOf));
  const provider = providers.includes(requested.provider) ? requested.provider : "";
  const scoped = formal.filter((s) => !provider || providerOf(s) === provider);
  const models = unique(scoped.map((s) => s.model));
  const model = models.includes(requested.model) ? requested.model : "";
  const efforts = unique(scoped.filter((s) => !model || s.model === model).map(effortOf)).sort(compareEfforts);
  const effort = efforts.includes(requested.effort) ? requested.effort : "";
  return { providers, models, efforts, provider, model, effort };
}
export function groupCatalog(items) {
  return unique(items.map(providerOf)).map((provider) => ({
    provider,
    models: unique(items.filter((s) => providerOf(s) === provider).map((s) => s.model)).map((model) => ({
      model,
      items: items.filter((s) => providerOf(s) === provider && s.model === model)
        .sort((a, b) => compareEfforts(effortOf(a), effortOf(b))),
    })),
  }));
}
