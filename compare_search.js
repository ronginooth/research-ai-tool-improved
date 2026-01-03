const https = require('https');

const API_KEY = '60rmiPDjXB789tnXQi01n4ifEuLRZokC2bNHVtpW';

function searchS2(query) {
    return new Promise((resolve, reject) => {
        const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=5&fields=title,citationCount,year,authors`;
        const options = {
            headers: {
                'x-api-key': API_KEY
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    resolve({ error: `Status ${res.statusCode}: ${data}` });
                    return;
                }
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ error: e.message });
                }
            });
        }).on('error', (e) => resolve({ error: e.message }));
    });
}

const tests = [
    {
        id: 1,
        original: "At their core, motile cilia are composed of a highly organized axoneme, typically exhibiting a 9+2 microtubule arrangement.",
        // Current: Heavily quoted based on Gemini prompt logic (quotes nouns, compound terms)
        current: '"motile cilia" "axoneme" "9+2 microtubule arrangement"',
        // Optimized: Relaxed, only quotes crucial distinct phrases or nothing
        optimized: 'motile cilia axoneme "9+2 microtubule arrangement"'
    },
    {
        id: 2,
        original: "Mutations in KIF6 have been linked to significant developmental disorders, including scoliosis in zebrafish",
        current: '"KIF6" "scoliosis" "zebrafish" "developmental disorders"',
        optimized: 'KIF6 scoliosis zebrafish "developmental disorders"'
    },
    {
        id: 3,
        original: "Recent findings demonstrating that KIF6 can actively move along microtubules, suggesting its role in delivering essential factors for proper ciliary activity",
        current: '"KIF6" "microtubules" "actively move" "ciliary activity"',
        optimized: 'KIF6 microtubules "actively move" ciliary activity'
    }
];

async function run() {
    console.log("Starting Search Comparison...\n");

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    for (const test of tests) {
        console.log(`--- Test Phrase ${test.id} ---`);
        console.log(`Original: ${test.original.substring(0, 80)}...`);

        // Run Current
        console.log(`\n[Current Logic] Query: ${test.current}`);
        const resCurrent = await searchS2(test.current);
        if (resCurrent.error) {
            console.log(`Error: ${resCurrent.error}`);
        } else {
            console.log(`Total Results: ${resCurrent.total}`);
            console.log(`Top Papers:`);
            (resCurrent.data || []).slice(0, 3).forEach(p => console.log(`  - ${p.title} (${p.year}) [Cites: ${p.citationCount}]`));
        }

        await sleep(2000); // Wait 2 seconds

        // Run Optimized
        console.log(`\n[Optimized Logic] Query: ${test.optimized}`);
        const resOptimized = await searchS2(test.optimized);
        if (resOptimized.error) {
            console.log(`Error: ${resOptimized.error}`);
        } else {
            console.log(`Total Results: ${resOptimized.total}`);
            console.log(`Top Papers:`);
            (resOptimized.data || []).slice(0, 3).forEach(p => console.log(`  - ${p.title} (${p.year}) [Cites: ${p.citationCount}]`));
        }
        console.log("\n==========================================\n");
        await sleep(2000); // Wait 2 seconds
    }
}

run();
