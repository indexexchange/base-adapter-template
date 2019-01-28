/* eslint no-sync: "off", no-console: "off", no-process-exit: "off" */
const fs = require('fs');
const glob = require('glob');
const path = require('path');
const util = require('util');

// Set up partner name and type variables
if (!process.argv[2] || process.argv[2].trim() === '') {
    console.log('ERROR: Please provide the company name as an argument e.g. "Index Exchange".\n');

    process.exit(1);
}

const partnerName = process.argv[2].trim()
    .replace(/\s\s+/g, ' ');
if (partnerName.match(/[^\w\s]/g)) {
    console.log('ERROR: Adapter name cannot include special characters.\n');

    process.exit(1);
}

// Check if adapter name includes number as first char
if (Number.isInteger(parseInt(partnerName.charAt(0), 10))) {
    console.log('ERROR: Adapter name cannot start with a number.\n');

    process.exit(1);
}

// Initializing constants
const partnerNameKebab = partnerName.replace(/\s/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
const PARTNER_TYPE_KEBAB = 'htb';
const PARTNER_TYPE_CAPITAL = 'Htb';
const partnerPath = path.join(__dirname, '/../../..', partnerNameKebab);
const adapterFilesPath = path.join(__dirname, '/../../..', '/**/*@(htb|nob).js');
const replaceTemplateFiles = [
    'DOCUMENTATION.md',
    'partner-exports.js',
    'partner.js'
];
const statsRegex = /statsId: '(.*)'/;
const promiseCopyFile = util.promisify(fs.copyFile);
const promiseWriteFile = util.promisify(fs.writeFile);
const promiseFindFiles = util.promisify(glob);
const promiseReadFile = util.promisify(fs.readFile);

/**
 * Parses a file to find the statsId
 * @param {string} file the data to parse and use to locate the statsId
 * @return {string} the statsId of the given file
 */
function readStatsId(file) {
    const regexMatch = statsRegex.exec(file);
    if (regexMatch && regexMatch.length) {
        return regexMatch[1];
    }

    return '';
}

/**
 * Capitalizes the first letter in each word
 * @param {string} wordToBeCapitalized the string to split and capitalize
 * @return {array} the camel-case capitalized word
 */
function camelCaseName(wordToBeCapitalized) {
    const splitName = wordToBeCapitalized.split(' ');
    let capitalizedName = '';
    for (const w of splitName) {
        capitalizedName += w.charAt(0)
            .toUpperCase() + w.slice(1);
    }

    return capitalizedName;
}

/**
 * Generates a new unique statsId for an adapter and sets them as the global variables
 * @param {array} existingStatsIds an array of existing statsIds
 * @param {string} adapterName partner name to use when generating statsId
 * @return {string} the newly generated statsId
 */
function generateStatsId(existingStatsIds, adapterName) {
    const statsIdSize = 3;
    const upperCaseName = adapterName.replace(/\s/g, '')
        .toUpperCase();
    let generationCount = 0;
    let tempStatsId = upperCaseName.substring(0, statsIdSize);

    /*
     * Loop through partner files in adapters folder to compare
     * To other StatsIds to make sure it doesn't exist
     */
    let statsIdExists = existingStatsIds.includes(tempStatsId);
    while (statsIdExists) {
        // Increment generation since there is an existing statsId
        generationCount += 1;

        // Check not end of string (3rd letter + generation count)
        if ((2 + generationCount) < adapterName.length) {
            tempStatsId = upperCaseName
                .substring(0, 2) + upperCaseName[2 + generationCount];

            statsIdExists = existingStatsIds.includes(tempStatsId);
        } else {
            tempStatsId += '1';
            statsIdExists = false;
        }
    }

    /*
     * Return statsId as <3 letters> or <3 letters>1 upon which we would need to
     * manually change it upon submission.
     */
    return tempStatsId;
}

/**
 * Reads and replaces placeholder values in a given file with the adapter values
 * @param {string} filePath the file to read
 * @param {string} statsId the statsId for the adapter
 * @return {string} the read contents of a file with replaced values
 */
function replacePlaceholderValues(filePath, statsId) {
    return promiseReadFile(filePath, 'utf8')
        .then((data) => {
            let replaced = data;
            const partnerCapitals = camelCaseName(partnerName);
            const statsIdLower = statsId.toLowerCase();
            replaced = replaced.replace(/%%Partner Name%%/g, partnerName);
            replaced = replaced.replace(/%%partner-name%%/g, partnerNameKebab);
            replaced = replaced.replace(/%%partnertype%%/g, PARTNER_TYPE_KEBAB);
            replaced = replaced.replace(/%%PartnerName%%/g, partnerCapitals);
            replaced = replaced.replace(/%%PartnerType%%/g, PARTNER_TYPE_CAPITAL);
            replaced = replaced.replace(/%%PARTNERID%%/g, statsId);
            replaced = replaced.replace(/%%partnerid%%/g, statsIdLower);

            return replaced;
        });
}

/**
 * Copies a file from the given template source to the new adapter folder.
 * Replaces placeholder values for files that have them.
 * @param {string} source the source template file to copy
 * @param {string} statsId the statsId
 * @return {promise} A promise upon completing the copy
 */
function promiseCopyTemplateFile(source, statsId) {
    return new Promise(() => {
        const filename = path.basename(source);
        let destination = path.join(partnerPath, '/');
        let partnerFileName = filename;

        if (filename.includes('partner')) {
            partnerFileName = filename.replace('partner', `${partnerNameKebab}-${PARTNER_TYPE_KEBAB}`);
        }

        console.log(`Setting up file: ${partnerFileName}`);

        destination = path.join(destination, partnerFileName);

        // If file name has placeholder values
        if (replaceTemplateFiles.includes(filename)) {
            // Replace placeholder values and save to destination
            return replacePlaceholderValues(source, statsId)
                .then((replacedFile) => {
                    // Write to new file
                    return promiseWriteFile(destination, replacedFile);
                });
        }

        return promiseCopyFile(source, destination);
    });
}

/**
 * Main function to add new partner adapter
 */
function addNewAdapter() {
    // Checking partner/name does not already exist
    if (fs.existsSync(partnerPath)) {
        console.log('ERROR: An adapter with this name already exists.\n');

        process.exit(1);
    }

    promiseFindFiles(adapterFilesPath)
        .then((filenames) => {
            return Promise.all(filenames.map((file) => {
                return promiseReadFile(file, 'utf8');
            }));
        })
        .then((files) => {
            // Find existing statsIds
            const existingIds = files.map(readStatsId);

            // Generate StatsId
            const statsId = generateStatsId(existingIds, partnerName);

            // Create partner folder
            console.log(`\nCreating partner folder: ${partnerPath}`);

            // Make dir, copy over and rename
            fs.mkdirSync(partnerPath);
            const templateFilesPath = path.join(__dirname, '/../bidding-adapter-template/*.*');

            return promiseFindFiles(templateFilesPath)
                .then((filenames) => {
                    // Loop through files and copy
                    return Promise.all(filenames.map((file) => {
                        return promiseCopyTemplateFile(file, statsId);
                    }));
                })
                .then(() => {
                    console.log('\n\nSUCCESS! Partner folder has been created.\n\n');
                });
        })
        .catch(() => {
            console.log(
                'ERROR: Something unexpected occurred, please reach out to Index Exchange'
                + ' to resolve this issue.\n'
            );
            process.exit(1);
        });
}

addNewAdapter();
