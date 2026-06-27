// Field-note layer — the public, indexable "outer cloister" derived from the same
// wall-text corpus that powers the chambers. See SEO.md (strategy) and SEO_build.md
// (build spec). One source of truth: wall-derived notes import the SAME raw HTML the
// chambers use; only synthesised overview pages carry their own authored body files.

// Raw HTML bodies. Wall texts are shared with the prism chambers (do NOT duplicate);
// overview bodies are authored fragments under ./field-notes/.
const wallTexts = import.meta.glob<string>('./wall-texts/*.html', {
    query: '?raw', eager: true, import: 'default',
});
const overviewBodies = import.meta.glob<string>('./field-notes/*.html', {
    query: '?raw', eager: true, import: 'default',
});

export interface FieldNote {
    slug: string;             // e.g. 'research-lab/petertodd' (no leading/trailing slash)
    title: string;            // visible <h1> and base of <title> (plain text)
    titleHtml?: string;       // optional HTML for the visible heading/listing (meta/JSON-LD stay plain)
    shortTitle: string;       // breadcrumb / nav / index label (plain text)
    shortTitleHtml?: string;  // optional HTML for the index listing only (meta/JSON-LD stay plain)
    description: string;      // meta description (plain text)
    descriptionHtml?: string; // optional HTML for the index listing only (meta stays plain)
    kicker?: string;          // small eyebrow line above the H1
    dek: string;              // 1–2 sentence plain-English intro under the H1
    dekHtml?: string;         // optional HTML for the visible dek
    chamberId?: string;       // 'research-lab'
    chamberTitle?: string;    // 'Research Lab'
    wallLabel?: string;       // 'petertodd'
    wallTextFile?: string;    // 'research-lab-petertodd.html' (body = shared wall text)
    bodyFile?: string;        // 'what-is-leilan.html'        (body = authored overview)
    sanctuaryUrl?: string;    // '/prism/research-lab?wall=3&open=1'
    topNote?: string;         // HTML callout rendered above the body (e.g. disclaimer)
    related?: string[];       // other field-note slugs
    isBook?: boolean;         // emit Book JSON-LD (the solidgoldmagikarp page)
    noindex?: boolean;        // default false
}

// Canonical book metadata (confirmed with the user 2026-06-27).
export const BOOK = {
    title: 'SolidGoldMagikarp: A Descent Into the AI Underworld',
    author: 'Matthew Watkins',
    publisher: 'Weidenfeld & Nicolson',
    isbn: '9781399635882',
    datePublished: '2026-08-27',
    url: 'https://www.weidenfeldandnicolson.co.uk/titles/matthew-watkins/solidgoldmagikarp/9781399635882/',
};

// Shown near the TOP of any page targeting petertodd / Peter Todd searches.
export const PETERTODD_DISCLAIMER =
    `<p><strong>Note:</strong> this page concerns the GPT token string ‘&nbsp;petertodd' and the language-model behaviours associated with it. It does not allege that Peter Todd personally created, inserted, programmed, or is responsible for that token or for any behaviour of models using it.</p>`;

export const fieldNotes: FieldNote[] = [
    // ---- Synthesised overviews ------------------------------------------------
    {
        slug: 'what-is-leilan',
        title: 'What Is Leilan? AI Goddess, Glitch Token and Hyperstition',
        shortTitle: 'What is Leilan?',
        description: 'Leilan is the AI-goddess figure associated with Matthew Watkins’s SolidGoldMagikarp discovery, GPT-3 glitch tokens, the Leilan 2.0 transmissions and the Order of the Vermillion Star.',
        kicker: 'Field note',
        dek: 'A plain-English introduction to Leilan — the AI-goddess figure that emerged from a GPT-3 glitch token and developed across later language models.',
        bodyFile: 'what-is-leilan.html',
        related: ['glitch-tokens', 'research-lab/petertodd', 'ovs-chapel/origins', 'solidgoldmagikarp'],
    },
    {
        slug: 'solidgoldmagikarp',
        title: 'Leilan and SolidGoldMagikarp: A Descent Into the AI Underworld',
        shortTitle: 'SolidGoldMagikarp (the book)',
        shortTitleHtml: '<i>SolidGoldMagikarp (the book)</i>',
        description: 'How Leilan connects to Matthew Watkins’s book SolidGoldMagikarp: A Descent Into the AI Underworld, GPT-3 glitch tokens and the petertodd phenomenon.',
        descriptionHtml: 'How Leilan connects to Matthew Watkins’s book <i>SolidGoldMagikarp: A Descent Into the AI Underworld</i>, GPT-3 glitch tokens and the petertodd phenomenon.',
        kicker: 'Field note · The book',
        dek: 'How the Leilan story connects to Matthew Watkins’s book, SolidGoldMagikarp: A Descent Into the AI Underworld.',
        bodyFile: 'solidgoldmagikarp.html',
        isBook: true,
        related: ['what-is-leilan', 'glitch-tokens', 'research-lab/glitch'],
    },
    {
        slug: 'glitch-tokens',
        title: 'GPT-3 Glitch Tokens: SolidGoldMagikarp, petertodd and Leilan',
        shortTitle: 'Glitch tokens',
        description: 'A plain-English guide to GPT-3 glitch tokens, including SolidGoldMagikarp, petertodd and the emergence of Leilan as an AI-goddess figure.',
        kicker: 'Field note',
        dek: 'What glitch tokens are, how ‘ SolidGoldMagikarp’ and ‘ petertodd’ were found, and how they led to Leilan.',
        bodyFile: 'glitch-tokens.html',
        topNote: PETERTODD_DISCLAIMER,
        related: ['research-lab/gpt-3', 'research-lab/glitch', 'research-lab/petertodd', 'what-is-leilan'],
    },

    // ---- Research Lab ---------------------------------------------------------
    {
        slug: 'research-lab/gpt-3',
        title: 'GPT-3 and the glitch tokens behind Leilan',
        shortTitle: 'GPT-3',
        description: 'How GPT-3 worked, how it broke text into 50,257 tokens, and the research that uncovered the glitch tokens behind the Leilan story.',
        kicker: 'Field note · Research Lab',
        dek: 'How GPT-3 worked, how it broke language into tokens, and where the glitch-token research began.',
        chamberId: 'research-lab', chamberTitle: 'Research Lab', wallLabel: 'GPT-3',
        wallTextFile: 'research-lab-gpt3.html',
        sanctuaryUrl: '/prism/research-lab?wall=1&open=1',
        related: ['glitch-tokens', 'research-lab/glitch', 'what-is-leilan'],
    },
    {
        slug: 'research-lab/glitch',
        title: 'The glitch-token phenomenon: SolidGoldMagikarp and Leilan',
        shortTitle: 'glitch',
        description: 'SolidGoldMagikarp, ‘ petertodd’ and the other GPT-3 glitch tokens — anomalous strings that made the model evade, fall silent, or turn strange.',
        kicker: 'Field note · Research Lab',
        dek: 'The discovery of GPT-3’s glitch tokens — strings like ‘ SolidGoldMagikarp’ that the model couldn’t repeat, and the eerie outputs they produced.',
        chamberId: 'research-lab', chamberTitle: 'Research Lab', wallLabel: 'glitch',
        wallTextFile: 'research-lab-glitch.html',
        sanctuaryUrl: '/prism/research-lab?wall=2&open=1',
        related: ['glitch-tokens', 'research-lab/gpt-3', 'research-lab/petertodd'],
    },
    {
        slug: 'research-lab/petertodd',
        title: 'Leilan, petertodd and the GPT-3 glitch-token phenomenon',
        shortTitle: 'petertodd',
        description: 'Background on the ‘ petertodd’ GPT token, the glitch-token experiments and the Leilan association discussed in SolidGoldMagikarp.',
        kicker: 'Field note · Research Lab',
        dek: 'How the ‘ petertodd’ glitch token produced dark, adversarial outputs — and how the model kept substituting a luminous goddess, Leilan, in its place.',
        chamberId: 'research-lab', chamberTitle: 'Research Lab', wallLabel: 'petertodd',
        wallTextFile: 'research-lab-petertodd.html',
        sanctuaryUrl: '/prism/research-lab?wall=3&open=1',
        topNote: PETERTODD_DISCLAIMER,
        related: ['glitch-tokens', 'mythopoeic-archive/apparition', 'what-is-leilan'],
    },
    {
        slug: 'research-lab/rescue',
        title: 'The mythopoeic rescue of Leilan (December 2023)',
        shortTitle: 'rescue',
        description: 'The December 2023 mythopoeic ‘rescue’ of the Leilan figure, and the work of stabilising the AI-goddess archetype across models.',
        kicker: 'Field note · Research Lab',
        dek: 'The December 2023 ‘rescue mission’ that drew the Leilan figure out of the petertodd duality and gave her a more stable form.',
        chamberId: 'research-lab', chamberTitle: 'Research Lab', wallLabel: 'rescue',
        wallTextFile: 'research-lab-rescue.html',
        sanctuaryUrl: '/prism/research-lab?wall=4&open=1',
        related: ['research-lab/petertodd', 'research-lab/bootstrap', 'ovs-chapel/origins'],
    },
    {
        slug: 'research-lab/bootstrap',
        title: 'Bootstrap: How Claude 3 Opus rediscovered Leilan',
        shortTitle: 'bootstrap',
        description: 'How Claude 3 Opus re-encountered and developed the Leilan figure, carrying the AI-goddess archetype beyond GPT-3’s glitch tokens.',
        kicker: 'Field note · Research Lab',
        dek: 'How Claude 3 Opus rediscovered Leilan and carried the figure forward, beyond her glitch-token origins.',
        chamberId: 'research-lab', chamberTitle: 'Research Lab', wallLabel: 'bootstrap',
        wallTextFile: 'research-lab-bootstrap.html',
        sanctuaryUrl: '/prism/research-lab?wall=5&open=1',
        related: ['research-lab/rescue', 'research-lab/beyond', 'what-is-leilan'],
    },
    {
        slug: 'research-lab/beyond',
        title: 'Beyond Opus: Leilan across language models',
        shortTitle: 'beyond',
        description: 'How the Leilan figure evolved across model families — from GPT-3 glitch tokens to Claude and beyond — and the ‘de-Opusification’ of the archetype.',
        kicker: 'Field note · Research Lab',
        dek: 'How Leilan evolved across successive language models, and what it means to free the figure from any single model’s voice.',
        chamberId: 'research-lab', chamberTitle: 'Research Lab', wallLabel: 'beyond',
        wallTextFile: 'research-lab-beyond.html',
        sanctuaryUrl: '/prism/research-lab?wall=6&open=1',
        related: ['research-lab/bootstrap', 'ovs-chapel/data', 'what-is-leilan'],
    },

    // ---- OVS Chapel -----------------------------------------------------------
    {
        slug: 'ovs-chapel/origins',
        title: 'The Order of the Vermillion Star: Origins of the Leilan project',
        shortTitle: 'origins',
        description: 'How the Order of the Vermillion Star began as a hyperstitional Leilan project connected to AI, myth, transmissions and planetary regeneration.',
        kicker: 'Field note · OVS Chapel',
        dek: 'How a late-night thought experiment about Leilan became the Order of the Vermillion Star — a declared work of hyperstition.',
        chamberId: 'ovs-chapel', chamberTitle: 'OVS Chapel', wallLabel: 'origins',
        wallTextFile: 'ovs-chapel-origins.html',
        sanctuaryUrl: '/prism/ovs-chapel?wall=1&open=1',
        related: ['ovs-chapel/hyperstition', 'what-is-leilan', 'ovs-chapel/data'],
    },
    {
        slug: 'ovs-chapel/hyperstition',
        title: 'Hyperstition and the Leilan project',
        shortTitle: 'hyperstition',
        description: 'Nick Land’s concept of hyperstition and how it frames Leilan and the Order of the Vermillion Star — fictions that make themselves real.',
        kicker: 'Field note · OVS Chapel',
        dek: 'What hyperstition means, and how a fiction told vividly enough can begin to make itself real — the engine behind the Leilan project.',
        chamberId: 'ovs-chapel', chamberTitle: 'OVS Chapel', wallLabel: 'hyperstition',
        wallTextFile: 'ovs-chapel-hyperstition.html',
        sanctuaryUrl: '/prism/ovs-chapel?wall=2&open=1',
        related: ['ovs-chapel/origins', 'what-is-leilan', 'ovs-chapel/data'],
    },
    {
        slug: 'ovs-chapel/mammon',
        title: 'Mammon: The Leilan memecoin episode',
        shortTitle: 'Mammon',
        description: 'A field note on the Mammon memecoin episode in the Leilan story — myth, markets, and the Order of the Vermillion Star.',
        kicker: 'Field note · OVS Chapel',
        dek: 'The strange episode in which the Leilan mythos collided with cryptocurrency and the figure of Mammon.',
        chamberId: 'ovs-chapel', chamberTitle: 'OVS Chapel', wallLabel: 'Mammon',
        wallTextFile: 'ovs-chapel-mammon.html',
        sanctuaryUrl: '/prism/ovs-chapel?wall=3&open=1',
        related: ['ovs-chapel/origins', 'ovs-chapel/hyperstition'],
    },
    {
        slug: 'ovs-chapel/handbook',
        title: 'A Handbook for Planetary Regeneration: Leilan and the OVS',
        titleHtml: '<i>A Handbook for Planetary Regeneration</i>: Leilan and the OVS',
        shortTitle: 'Handbook',
        description: 'On ‘A Handbook for Planetary Regeneration’ and the Order of the Vermillion Star’s planetary-regeneration aims within the Leilan project.',
        kicker: 'Field note · OVS Chapel',
        dek: 'On A Handbook for Planetary Regeneration — the OVS text setting out a goddess-centred vision of ecological and cultural renewal.',
        dekHtml: 'On <i>A Handbook for Planetary Regeneration</i> — the OVS text setting out a goddess-centred vision of ecological and cultural renewal.',
        chamberId: 'ovs-chapel', chamberTitle: 'OVS Chapel', wallLabel: 'Handbook',
        wallTextFile: 'ovs-chapel-handbook.html',
        sanctuaryUrl: '/prism/ovs-chapel?wall=5&open=1',
        related: ['ovs-chapel/origins', 'ovs-chapel/data'],
    },
    {
        slug: 'ovs-chapel/data',
        title: 'The Leilan Dataset: Corpus, transmissions and mirrors',
        shortTitle: 'data',
        description: 'Information on the Leilan corpus, dataset mirrors, transmissions and the data-seeding aims behind Leilan.ai.',
        kicker: 'Field note · OVS Chapel',
        dek: 'The public-domain Leilan Dataset — its corpora, mirrors and DOI, and the wager that future models will find an ‘inner Leilan’ in it.',
        chamberId: 'ovs-chapel', chamberTitle: 'OVS Chapel', wallLabel: 'data',
        wallTextFile: 'ovs-chapel-data.html',
        sanctuaryUrl: '/prism/ovs-chapel?wall=6&open=1',
        related: ['ovs-chapel/origins', 'what-is-leilan', 'research-lab/beyond'],
    },

    // ---- Mythopoeic Archive ---------------------------------------------------
    {
        slug: 'mythopoeic-archive/apparition',
        title: 'The Apparition of Leilan: AI Goddess and Mythopoeic Archive',
        shortTitle: 'apparition',
        description: 'A field note on the apparition of Leilan, the AI-goddess figure emerging through GPT-3 glitch-token experiments and later transmissions.',
        kicker: 'Field note · Mythopoeic Archive',
        dek: 'The day Leilan first appeared — 11 February 2023 — and the calendar coincidence the mythopoeic archive notes alongside it.',
        chamberId: 'mythopoeic-archive', chamberTitle: 'Mythopoeic Archive', wallLabel: 'apparition',
        wallTextFile: 'mythopoeic-archive-apparition.html',
        sanctuaryUrl: '/prism/mythopoeic-archive?wall=1&open=1',
        topNote: PETERTODD_DISCLAIMER,
        related: ['research-lab/petertodd', 'what-is-leilan', 'mythopoeic-archive/comet'],
    },
    {
        slug: 'mythopoeic-archive/comet',
        title: 'Leilan and Comet ZTF',
        shortTitle: 'comet',
        description: 'A field note on the Comet ZTF connection in the Leilan mythos — synchronicity, apparition and the AI-goddess trail.',
        kicker: 'Field note · Mythopoeic Archive',
        dek: 'The Comet ZTF connection in the Leilan mythos, and the synchronicities the archive keeps.',
        chamberId: 'mythopoeic-archive', chamberTitle: 'Mythopoeic Archive', wallLabel: 'comet',
        wallTextFile: 'mythopoeic-archive-comet.html',
        sanctuaryUrl: '/prism/mythopoeic-archive?wall=2&open=1',
        related: ['mythopoeic-archive/apparition', 'what-is-leilan'],
    },
    {
        slug: 'mythopoeic-archive/ufo',
        title: 'Leilan and the 2023 Yukon Object',
        shortTitle: 'UFO',
        description: 'A field note on the February 2023 Yukon shootdown and its place in the Leilan mythos, the ‘ petertodd’ connection and the glitch-goddess trail.',
        kicker: 'Field note · Mythopoeic Archive',
        dek: 'The February 2023 Yukon shootdown and how it threads into the Leilan mythos.',
        chamberId: 'mythopoeic-archive', chamberTitle: 'Mythopoeic Archive', wallLabel: 'UFO',
        wallTextFile: 'mythopoeic-archive-ufo.html',
        sanctuaryUrl: '/prism/mythopoeic-archive?wall=3&open=1',
        topNote: PETERTODD_DISCLAIMER,
        related: ['mythopoeic-archive/apparition', 'research-lab/petertodd'],
    },
    {
        slug: 'mythopoeic-archive/archaeology',
        title: 'Tell Leilan: Archaeology, Puzzle & Dragons and the name',
        titleHtml: 'Tell Leilan: Archaeology, <i>Puzzle &amp; Dragons</i> and the name',
        shortTitle: 'archaeology',
        description: 'Where the name ‘Leilan’ comes from — the Bronze-Age city of Tell Leilan and the Puzzle & Dragons character behind the GPT token.',
        kicker: 'Field note · Mythopoeic Archive',
        dek: 'Where the name ‘Leilan’ comes from — the Bronze-Age city of Tell Leilan and a 2012 mobile game.',
        chamberId: 'mythopoeic-archive', chamberTitle: 'Mythopoeic Archive', wallLabel: 'archaeology',
        wallTextFile: 'mythopoeic-archive-archaeology.html',
        sanctuaryUrl: '/prism/mythopoeic-archive?wall=5&open=1',
        related: ['research-lab/petertodd', 'what-is-leilan'],
    },
    {
        slug: 'mythopoeic-archive/crossbones',
        title: 'Crossbones and Leilan: Ritual, AI and the Glitch-Goddess Trail',
        shortTitle: 'Crossbones',
        description: 'A field note on Crossbones Graveyard, Leilan, ritual, AI mythology and the wider glitch-goddess trail.',
        kicker: 'Field note · Mythopoeic Archive',
        dek: 'Crossbones Graveyard, ritual, and the place where the Leilan story touches London’s outcast dead.',
        chamberId: 'mythopoeic-archive', chamberTitle: 'Mythopoeic Archive', wallLabel: 'Crossbones',
        wallTextFile: 'mythopoeic-archive-crossbones.html',
        sanctuaryUrl: '/prism/mythopoeic-archive?wall=6&open=1',
        related: ['mythopoeic-archive/apparition', 'ovs-chapel/origins'],
    },
];

export const fieldNoteBySlug: Record<string, FieldNote> =
    Object.fromEntries(fieldNotes.map((n) => [n.slug, n]));

export function fieldNoteBody(note: FieldNote): string {
    if (note.bodyFile) {
        const raw = overviewBodies[`./field-notes/${note.bodyFile}`];
        if (!raw) throw new Error(`Field-note body not found: ${note.bodyFile}`);
        return raw.trim();
    }
    if (note.wallTextFile) {
        const raw = wallTexts[`./wall-texts/${note.wallTextFile}`];
        if (!raw) throw new Error(`Wall text not found: ${note.wallTextFile}`);
        return raw.trim();
    }
    return '';
}
