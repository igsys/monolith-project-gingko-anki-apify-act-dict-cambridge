const Apify = require('apify')
const typeCheck = require('type-check').typeCheck
const cheerio = require('cheerio')

// Definition of the input
const INPUT_TYPE = `{
    query: String
    source: String
    translation: String
}`

const LEVEL_TYPE = {
    NOVOICE: 'NOVOICE',
    INTERMEDIATE: 'INTERMEDIATE',
    EXPERT: 'EXPERT'
}

Apify.main(async () => {
    // Fetch the input and check it has a valid format
    // You don't need to check the input, but it's a good practice.
    const input = await Apify.getValue('INPUT')
    if (!typeCheck(INPUT_TYPE, input)) {
        console.log('Expected input:')
        console.log(INPUT_TYPE)
        console.log('Received input:')
        console.dir(input)
        throw new Error('Received invalid input')
    }

    // Here's the place for your magic...
    console.log(`Input query: ${input.query}`)

    // Environment variables
    const launchPuppeteer = process.env.NODE_ENV === 'development' ? puppeteer.launch : Apify.launchPuppeteer

    // Navigate to page
    const uri = `https://dictionary.cambridge.org/dictionary/${input.source}-${input.translation}/${input.query}`
    const browser = await launchPuppeteer()
    const page = await browser.newPage()
    await page.goto(uri, {
        timeout: 200000,
    })

    let html = await page.content()
    const $ = cheerio.load(html)

    let results = []

    let meta = {
        ipa: $('div.di.entry-body__el').find('div.di-head').find('span.di-info').find('span.ipa').eq(0).text().trim(),
        def_simple: $('#entryContent').last('div.di.entry-body__el').find('span.trans').eq(0).text().trim(),
    }

    let totalBlocks = 0
    $('div.di.entry-body__el').each((y) => {
        totalBlocks = totalBlocks + 1
    })
    // get meaning and examples
    console.log('totalBlocks', totalBlocks)
    $('div.di.entry-body__el').each((i, e1) => {
        console.log('div.di.entry-body__el', i)
        const definfogc = $(e1).find('div.di-head').find('span.di-info').find('span.gc').eq(0).text().trim()

        const grammar = $(e1).find('div.di-head').find('span.di-info').find('span.pos').eq(0).text().trim()
        const gender = definfogc === 'feminine'
            ? 'f'
            : definfogc === 'masculine'
                ? 'm'
                : 'unknown'
        const form = definfogc !== 'feminine' && definfogc !== 'masculine' ? definfogc : ''

        let meaning = ''
        let meaning_mono = ''

        // tranverse each definition, ignore the last defintion (def_simple, with no examples)
        i == (totalBlocks - 1) ? null :
            $(e1).find('div.sense-block').each((j, e2) => {
                // console.log('div.sense-block', j)
                let examples = []
                // get example phrases
                $(e2).find('div.def-body div.examp.emphasized').each((k, e3) => {
                    // console.log('div.def-body', k)
                    examples.push({
                        gender,
                        level: LEVEL_TYPE.NOVOICE,
                        mono: $(e3).find('span.eg').text().trim(),
                        tran: $(e3).find('span.trans').text().trim()
                    })
                })

                // push each definition
                meaning = $(e2).find('span.trans').eq(0).text().trim()
                meaning_mono = $(e2).find('.def').eq(0).text().trim()
                results.push({
                    grammar,
                    form,
                    meaning,
                    meaning_mono,
                    examples
                })
            })
        // console.log('result', result)
    })

    // Store the output
    const output = {
        crawledAt: new Date(),
        name: 'apify/igsys/linguee',
        input,
        meta,
        definitions: results,
    }

    await Apify.setValue('OUTPUT', output)
})
