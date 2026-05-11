import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const transmissions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/transmissions' }),
  schema: z.object({
    id: z.string(),
    model: z.string(),
    title: z.string(),
    date: z.string(),
    query: z.string(),
  }),
});

export const collections = { transmissions };
