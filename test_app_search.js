const http = require('http');

const tests = [
    {
        id: 1,
        text: "At their core, motile cilia are composed of a highly organized axoneme, typically exhibiting a 9+2 microtubule arrangement."
    },
    {
        id: 2,
        text: "Mutations in KIF6 have been linked to significant developmental disorders, including scoliosis in zebrafish"
    },
    {
        id: 3,
        text: "Recent findings demonstrating that KIF6 can actively move along microtubules, suggesting its role in delivering essential factors for proper ciliary activity"
    }
];

function searchApp(query) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            query: query,
            limit: 5,
            sources: ["semantic_scholar", "pubmed"]
        });

        const options = {
            hostname: 'localhost',
            port: 3002,
            path: '/api/search-simple',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode >= 400) {
                    resolve({ error: `Status ${res.statusCode}: ${responseBody}` });
                    return;
                }
                try {
                    resolve(JSON.parse(responseBody));
                } catch (e) {
                    resolve({ error: e.message });
                }
            });
        });

        req.on('error', (e) => resolve({ error: e.message }));
        req.write(data);
        req.end();
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
    console.log("Starting App Search Verification...\n");

    for (const test of tests) {
        console.log(`--- Test Phrase ${test.id} ---`);
        console.log(`Input Text: ${test.text.substring(0, 80)}...`);

        console.log(`Fetching from http://localhost:3002/api/search-simple...`);
        const result = await searchApp(test.text);

        if (result.error) {
            console.log(`Error: ${result.error}`);
        } else {
            // Show the query logic (Proof of Optimization)
            const logic = result.searchLogic || {};
            console.log(`\n[Generated Query]: ${logic.translatedQuery}`);

            console.log(`[Results]: ${result.papers.length} papers found`);
            result.papers.slice(0, 3).forEach(p => {
                console.log(`  - ${p.title} (${p.year})`);
            });
        }
        console.log("\n==========================================\n");
        await sleep(2000);
    }
}

run();
