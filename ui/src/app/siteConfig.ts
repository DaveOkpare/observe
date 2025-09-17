export const siteConfig = {
  name: "Planner",
  url: "https://planner.tremor.so",
  description: "The simplest dashboard template.",
  baseLinks: {
    traces: {
      overview: "/traces/overview",
      monitoring: "/traces/monitoring",
      audits: "/traces/audits",
    },
  },
}

export type siteConfig = typeof siteConfig
