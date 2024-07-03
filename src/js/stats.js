const { SlippiGame } = require('@slippi/slippi-js');
const { TeamColors } = require('./constants.js');
const { createCollapsibleSection, appendCollapsibleSection } = require('./collapsible.js');
const { getSelectedFolderFromLocalStorage, findFilesInDir, convertUTCtoLocalTime, getCharacterIconPath } = require('./utils.js');

const ProcessedFilesModule = (() => {
    // Initialize an empty set to store processed file names
    const processedFiles = new Set();

    // Function to add a file to the set of processed files
    const addProcessedFile = (fileName) => {
        processedFiles.add(fileName);
    };

    // Function to check if a file has been processed
    const hasProcessedFile = (fileName) => {
        return processedFiles.has(fileName);
    };

    const processedFilesSize = () => {
        return processedFiles.size;
    }

    // Return the public interface of the module
    return {
        addProcessedFile,
        hasProcessedFile,
        processedFilesSize
    };
})();

async function processFiles() {
    // Check if a folder is selected
    const selectedFolder = getSelectedFolderFromLocalStorage();
    console.log("Selected folder: " + selectedFolder)
    if (!selectedFolder || selectedFolder === null || selectedFolder === "null") {
        console.log('Please select a folder first.');
        createMessageErrorDirectory(document)
        return;
    }

    // Get the value of the file order radio buttons
    const fileOrderRadio = document.querySelector('input[name="fileOrder"]:checked');
    const fileOrder = fileOrderRadio ? fileOrderRadio.value : 'Descending';

    // Find .slp files in the selected folder
    let gameFiles = findFilesInDir(selectedFolder, '.slp', fileOrder);

    // Get the value of the file count radio buttons
    const fileCountRadio = document.querySelector('input[name="fileCount"]:checked');
    const selectedFileCount = fileCountRadio ? fileCountRadio.value : 'ALL';

    // Determine the number of files to process based on the user's selection
    let totalFiles;
    if (selectedFileCount === 'ALL') {
        totalFiles = gameFiles.length - ProcessedFilesModule.processedFilesSize();
        console.log(ProcessedFilesModule.processedFilesSize())
        console.log(totalFiles);
    } else if (selectedFileCount === 'CUSTOM') {
        const customFileCount = parseInt(document.getElementById('customFileCount').value);
        if (!isNaN(customFileCount)) {
            totalFiles = Math.min(customFileCount, gameFiles.length);
        } else {
            console.log('Invalid custom file count: '+customFileCount);
            createMessageInvalidCount(document)
            return;
        }
    } else {
        // Assume a specific number is selected
        totalFiles = parseInt(selectedFileCount);
    }

    showLoadingIcon();

    // Show loading bar and text
    const loadingText = document.getElementById('loading-text');
    const loadingBar = document.getElementById('progress');
    loadingText.style.display = 'block';
    loadingBar.style.width = '0';

    let processedCount = 0;
    let filesProcessed = 0; // Track the number of files processed
    let singlesChecked = document.getElementById('ignoreSingles').checked;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    console.log('startDate: '+ startDate + ' endDate '+endDate)
    for (let i = 0; i < gameFiles.length && processedCount < totalFiles; i++) {
        const gameFile = gameFiles[i];
        const fileName = gameFile.split('\\').pop(); // Get the file name

        // Check if the file has already been processed
        if (ProcessedFilesModule.hasProcessedFile(fileName)) {
            console.log(`File '${fileName}' has already been processed.`);
            continue; // Skip processing
        }

        // Calculate progress and update the loading bar
        const progress = ((processedCount + 1) / totalFiles) * 100;
        loadingBar.style.width = `${progress}%`;

        // Update loading text
        loadingText.textContent = `${processedCount}/${totalFiles}`;

        // Compute stats asynchronously
        await new Promise(resolve => {
            setTimeout(() => {
                // Pass the totalFiles argument to the computeStats function
                computeStats(gameFile, totalFiles, singlesChecked, startDate, endDate).then(result => {
                    if (result !== 'skipped') {
                        processedCount++;
                        filesProcessed++;

                        ProcessedFilesModule.addProcessedFile(fileName);
                        console.log(`File '${fileName}' processed successfully.`);
                    }
                    resolve();
                });
            }, 0);
        });
    }

    createMessageProcessed(filesProcessed, document);

    hideLoadingIcon();

    loadingBar.style.width = '100%';
    // Hide loading text and bar when done
    loadingText.style.display = 'none';

    highlightMatchingColumns(); // check matches for highlighted text after processing new files
    hideShortGames(); // check short games to be hidden after processing
}

async function computeStats(gameFile, totalFiles, singlesChecked, startDate, endDate) {
    const game = new SlippiGame(gameFile);
    const settings = game.getSettings();

    if (singlesChecked && !settings.isTeams) {
        console.log(`'${gameFile}': singles game when ignoreSingles is checked.`);
        return 'skipped';
    }

    const metadata = game.getMetadata();

    // check game is completed
    if(metadata === null) {
        console.log(`'${gameFile}': metadata === null; game not completed or otherwise invalid.`);
        return 'skipped';
    }

    // dates compared in UTC
    const fileStartDate = convertUTCtoLocalTime(metadata.startAt, 'CT');
    const datePart = fileStartDate.split(' ')[0]; // Split at the space and get the first part
    const [month, day, year] = datePart.split('/');
    const formattedDate = new Date(`${year}-${month}-${day}`);
    
    const startDateObject = new Date(startDate);
    const endDateObject = new Date(endDate);
    
    if (formattedDate < startDateObject || formattedDate > endDateObject) {
        console.log(`'${gameFile}': game date ${formattedDate} outside of user selected dates ${startDateObject} - ${endDateObject}`);
        return 'skipped';
    }

    const stats = game.getStats();
    const latestFrame = game.getLatestFrame();
    const gameEnd = game.getGameEnd();

    const stockCounts = settings.players.map((player, index) => {
        if (latestFrame.players[index] != null) {
            return latestFrame.players[index].post.stocksRemaining;
        } else {
            return 0;
        }
    });

    const filePath = game.getFilePath();
    const fileName = filePath.split('\\').pop(); // Assuming the path separator is '\' (backslash)

    // Create a collapsible container for this file's output
    const collapsibleSection = createCollapsibleSection(metadata, settings, gameEnd, latestFrame, stockCounts, filePath);

    // Check if collapsibleSection is not null or undefined
    if (collapsibleSection) {
        appendCollapsibleSection(collapsibleSection); // Append collapsible section to container

        // Get the body of the collapsible section
        const collapsibleBody = collapsibleSection.querySelector('.collapsible-body');

        const table = createTable();

        const labelRow = table.insertRow();
        
        const emptyCell = labelRow.insertCell();
        emptyCell.textContent = fileName;
        emptyCell.style.fontSize = 'smaller';
        
        settings.players.forEach((player, index) => {
            const playerCell = labelRow.insertCell();
            const playerNameSpan = document.createElement('span');
            playerNameSpan.textContent = player.displayName;
            playerNameSpan.style.fontWeight = 'bold';
            
            const connectCodeSpan = document.createElement('span');
            connectCodeSpan.textContent = player.connectCode;
            connectCodeSpan.style.fontSize = 'smaller';
            connectCodeSpan.style.fontWeight = 'normal';
            
            playerCell.appendChild(playerNameSpan);
            playerCell.appendChild(document.createTextNode(' ')); // Add space between name and connect code
            playerCell.appendChild(connectCodeSpan);
        });

        // Add player data rows
        // addPlayerData(table, 'Character', settings.players.map(player => characters.getCharacterShortName(player.characterId)));
        addPlayerData(table, 'Stocks Remaining', stockCounts, settings);
        addPlayerData(table, 'KOs', stats.overall.map(playerStats => `${playerStats.killCount}`), settings);
        addPlayerData(table, 'Total Damage', stats.overall.map(playerStats => `${Math.round(playerStats.totalDamage)}`), settings);
        addPlayerData(table, 'Grabs', stats.actionCounts.map(actionCounts => 
            `${actionCounts.grabCount.success} / ${actionCounts.grabCount.fail + actionCounts.grabCount.success}`));
        addPlayerData(table, 'Throws (f / b / u / d)', stats.actionCounts.map(actionCounts => 
            `${actionCounts.throwCount.forward + actionCounts.throwCount.back + actionCounts.throwCount.up + actionCounts.throwCount.down} 
            (${actionCounts.throwCount.forward} / ${actionCounts.throwCount.back} / ${actionCounts.throwCount.up} / ${actionCounts.throwCount.down})`));
        addPlayerData(table, 'Roll / Air Dodge / Spotdodge', stats.actionCounts.map(actionCounts => 
            `${actionCounts.rollCount} / ${actionCounts.airDodgeCount} / ${actionCounts.spotDodgeCount}`));
        addPlayerData(table, 'WD / WL / DD / Ledgegrab', stats.actionCounts.map(actionCounts => 
            `${actionCounts.wavedashCount} / ${actionCounts.wavelandCount} / ${actionCounts.dashDanceCount} / ${actionCounts.ledgegrabCount}`));
        addPlayerData(table, 'Inputs / Minute', stats.overall.map(playerStats => `${Math.round((playerStats.inputsPerMinute.ratio) * 10) / 10}`));
        addPlayerData(table, 'L-Cancel %', stats.actionCounts.map(actionCounts => {
            const successCount = actionCounts.lCancelCount.success;
            const totalCount = successCount + actionCounts.lCancelCount.fail;
            return `${Math.round((successCount / totalCount) * 100)}% (${successCount} / ${totalCount})`;
        }), settings);
        addPlayerData(table, 'Team Color', settings.players.map(player => TeamColors[player.teamId].toString()));

        appendTable(table);

        console.log(fileName + " " + stages.getStageName(settings.stageId));
        // if(gameEnd != null) {
        //     console.log('LRAS: '+ (parseInt(gameEnd.lrasInitiatorIndex)+ 1))
        //     console.log("gameEnd.gameEndMethod: "+gameEnd.gameEndMethod);    
        // }
        console.log("---");
    
        // Append the table to the collapsible body
        collapsibleBody.appendChild(table);
    }
    // const processedCount = document.getElementById('processed-count');
    // processedCount.textContent = `${parseInt(processedCount.textContent) + 1} / ${totalFiles}`;

    // Indicate that the game was not skipped
    return 'processed';
}

// Function to add player data to the table
function addPlayerData(table, label, data, settings) {
    const row = table.insertRow();
    const labelCell = row.insertCell();
    let valueCells;

    if (Array.isArray(data)) {
        valueCells = data.map(value => {
            const cell = row.insertCell();
            cell.textContent = value;
            return cell;
        });

        // Find the maximum value in the data array
        const maxValue = Math.max(...data);

        // Apply gold to the cell with the maximum value
        valueCells.forEach(cell => {
            if (parseFloat(cell.textContent) === maxValue) {
                cell.classList.add('gold-text');
            }
        });
    } else {
        const valueCell = row.insertCell();
        valueCell.textContent = data;
        valueCell.colSpan = table.rows[0].cells.length - 1; // Span the entire table width for non-array data (deprecated)
    }

    labelCell.textContent = label;
    labelCell.style.fontWeight = 'bold';

    let teamColors;

    // Determine team color and add corresponding class to value cells
    switch (label) {
        case 'Team Color':
            teamColors = data;
            const columnIndex = Array.from(row.parentNode.children).indexOf(row);
            valueCells.forEach((cell, index) => {
                const teamColor = teamColors[index];
                const columnCells = Array.from(table.querySelectorAll(`tr td:nth-child(${index + 2})`));
                columnCells.forEach(columnCell => {
                    columnCell.classList.add(`team-${teamColor}`);
                });
            });
            break;
        case 'KOs':
            const KOCounts = data;
            KOCounts.forEach((count, index) => {
                const teamId = settings.players[index].teamId
    
                // Clear the contents of the cell before appending the icons
                valueCells[index].textContent = '';
            
                // Create a span element to hold the text content
                // const countSpan = document.createElement('span');
                // countSpan.textContent = '×' + count;
                // countSpan.style.transform = 'translateX(20px)';
                
                for (let i = 0; i < count; i++) {
                    const KOIcon = document.createElement('img');
                    const iconPath = getKOIconPath(teamId);
                    KOIcon.src = iconPath;
                    KOIcon.classList.add('KO-icon');
                    KOIcon.style.transform = 'translateY(2px)';
                    KOIcon.style.marginTop = '0px';
                    KOIcon.style.marginBottom = '0';
                    valueCells[index].appendChild(KOIcon); // Append each KO icon to the value cell
                }
        
                // Append the count span after appending all the KO icons
                // valueCells[index].appendChild(countSpan);
            });
            break;
        case 'Total Damage':
            teamColors = settings.players.map(player => {
                switch (player.teamId) {
                    case 0: // RED
                        return '#F15959';
                    case 1: // BLU
                        return '#6565FE';
                    case 2: // GRN
                        return '#4CE44C';
                    default:
                        return '#000000'; // Default to black if unknown team
                }
            });
            // Calculate the total damage for each team
            const teamTotalDamage = {};
            for (const [index, playerDamage] of data.entries()) {
                const teamColor = teamColors[index];
                if (!(teamColor in teamTotalDamage)) {
                    teamTotalDamage[teamColor] = 0;
                }
                teamTotalDamage[teamColor] += parseInt(playerDamage);
            }
        
            // Apply background gradient based on percentage of team damage
            valueCells.forEach((cell, index) => {
                const teamColor = teamColors[index];
                const playerDamage = parseInt(data[index]);
                const teamTotal = teamTotalDamage[teamColor];
                const percentage = (playerDamage / teamTotal) * 100;
                const gradientHeight = `${percentage}%`;
                const gradientColor = `rgba(${parseInt(teamColor.substring(1, 3), 16)}, ${parseInt(teamColor.substring(3, 5), 16)}, ${parseInt(teamColor.substring(5, 7), 16)}, 0.3)`;
                cell.style.background = `linear-gradient(to top, ${gradientColor} ${gradientHeight}, transparent ${gradientHeight})`;
            });
            break;
        case 'Stocks Remaining':
            const stocksRemaining = data;
    
            stocksRemaining.forEach((stocks, index) => {
                if (settings.players[index]) {
                    const characterId = settings.players[index].characterId;
                    const color = settings.players[index].characterColor;
    
                    // Clear the number in the cell before appending the icons
                    valueCells[index].textContent = '';
    
                    if (stocks > 0) {
                        for (let i = 0; i < stocks; i++) {
                            const stockIcon = document.createElement('img');
                            const iconPath = getCharacterIconPath(characterId, color);
                            stockIcon.src = iconPath;
                            stockIcon.classList.add('character-icon');
                            stockIcon.style.transform = 'translateY(2px)';
                            stockIcon.style.marginTop = '0px';
                            stockIcon.style.marginBottom = '0';
                            valueCells[index].appendChild(stockIcon); // Append each stock icon to the value cell
                        }
                    } else {
                        const stockIcon = document.createElement('img');
                        const iconPath = getCharacterIconPath(characterId, color);
                        stockIcon.src = iconPath;
                        stockIcon.classList.add('character-icon'); 
                        stockIcon.style.transform = 'translateY(2px)';
                        stockIcon.style.marginTop = '0px';
                        stockIcon.style.opacity = '0.3'; // Apply opacity to stock icon if stocks are 0
                        valueCells[index].appendChild(stockIcon); // Append the stock icon to the value cell
                    }
                }
            });
            break;
        case 'L-Cancel %':
            teamColors = settings.players.map(player => {
                switch (player.teamId) {
                    case 0: // RED
                        return '#F15959';
                    case 1: // BLU
                        return '#6565FE';
                    case 2: // GRN
                        return '#4CE44C';
                    default:
                        return '#000000'; // Default to black if unknown team
                }
            });
            const lcancelsPercentages = data.map(item => {
                const match = item.match(/\d+%/)
                return match ? match[0] : null; // Return the matched percentage or null if not found
            }).filter(Boolean);
    
            lcancelsPercentages.forEach((percentage, index) => {
                const teamColor = teamColors[index];
                const gradientWidth = percentage;
                const gradientColor = `rgba(${parseInt(teamColor.substring(1, 3), 16)}, ${parseInt(teamColor.substring(3, 5), 16)}, ${parseInt(teamColor.substring(5, 7), 16)}, 0.3)`;
                valueCells[index].style.background = `linear-gradient(to right, ${gradientColor} ${gradientWidth}, transparent ${gradientWidth})`;
            });
            break;
    }
    
    // Apply alternating row shades
    const rowIndex = Array.from(table.rows).indexOf(row);
    const isEvenRow = rowIndex % 2 === 0;
    row.classList.add(isEvenRow ? 'table-row-even' : 'table-row-odd');
}

function showLoadingIcon() {
    document.getElementById('loading-icon').style.display = 'flex';
}

function hideLoadingIcon() {
    document.getElementById('loading-icon').style.display = 'none';
}

function createMessageErrorDirectory(document) {
    const message = document.createElement('div');
    message.classList.add('message');
    message.textContent = 'No directory chosen. Use Select Folder button.'
    document.body.appendChild(message);

    // Remove the message after 5 seconds
    setTimeout(() => {
        document.body.removeChild(message);
    }, 5000);
}

function createMessageInvalidCount(document) {
    const message = document.createElement('div');
    message.classList.add('message');
    message.textContent = 'Invalid file count. Please enter a valid number.'
    document.body.appendChild(message);

    // Remove the message after 5 seconds
    setTimeout(() => {
        document.body.removeChild(message);
    }, 5000);
}

function createMessageProcessed(filesProcessed, document) {
    const message = document.createElement('div');
    message.classList.add('message');
    message.textContent = filesProcessed + (filesProcessed === 1 ? ' file' : ' files') + ' processed.';
    document.body.appendChild(message);

    // Remove the message after 5 seconds
    setTimeout(() => {
        document.body.removeChild(message);
    }, 5000);
}

const getKOIconPath = (teamId) => {
    const KOpath = path.join(__dirname, `../../images/misc/KO-${teamId}.png`);
    return KOpath;
};

function createTable() {
    const table = document.createElement('table');
    table.classList.add('slp-table');
    return table;
}

function appendTable(table) {
    const tableContainer = document.getElementById('tableContainer');
    tableContainer.appendChild(table);
}

module.exports = {
    processFiles,
    computeStats
};