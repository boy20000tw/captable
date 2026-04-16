import { z } from "zod";

export const ProjectionAssumptionsSchema = z.object({
  revenueYear1: z.number().min(0),
  revenueGrowth: z.array(z.number()),      // length = years - 1
  grossMargin: z.number().min(0).max(1),
  salesMarketing: z.number().min(0),       // % of revenue
  rnd: z.number().min(0),
  gAndA: z.number().min(0),
  depreciation: z.number().min(0),
  capex: z.number().min(0),
  workingCapital: z.number().min(0),
  taxRate: z.number().min(0).max(1),
});

export type ProjectionAssumptions = z.infer<typeof ProjectionAssumptionsSchema>;

export const DEFAULT_ASSUMPTIONS: ProjectionAssumptions = {
  revenueYear1: 1_000_000,
  revenueGrowth: [2.0, 1.5, 1.0, 0.6],  // 4 entries for years 2-5
  grossMargin: 0.70,
  salesMarketing: 0.30,
  rnd: 0.25,
  gAndA: 0.15,
  depreciation: 0.03,
  capex: 0.05,
  workingCapital: 0.10,
  taxRate: 0.20,
};
