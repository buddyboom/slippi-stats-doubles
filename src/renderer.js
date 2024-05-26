const { ipcRenderer } = require('electron');
const { existsSync, readdirSync, lstatSync } = require('fs');
const { join } = require('path');
const { SlippiGame } = require('@slippi/slippi-js');
const { characters, stages } = require('@slippi/slippi-js');
const { dialog } = require('electron');
const path = require('path')

const TeamColors = {
    0: "RED",
    1: "BLU",
    2: "GRN"
};

const getCharacterIconPath = (characterId, color) => {
    const iconPath = path.join(__dirname, `../images/characters/${characterId}/${color}/stock.png`);
    return iconPath;
};

const getKOIconPath = (teamId) => {
    const KOpath = path.join(__dirname, `../images/misc/KO-${teamId}.png`);
    return KOpath;
};

const getStagePath = (stageId) => {
    const stagePng = path.join(__dirname, `../images/stages/${stageId}.png`);
    return stagePng;
};

function convertUTCtoLocalTime(utcString, timezone) {
    const utcDate = new Date(utcString);
  
    // Get the UTC offset for the specified timezone
    const timezoneOffset = timezone === 'CT' ? 0 : 0; // Central Time (CT) is UTC-6
  
    // Apply the timezone offset to the UTC date
    const localDate = new Date(utcDate.getTime() + (timezoneOffset * 60 * 60 * 1000));

    // auto formatting had a comma
    // Format the local date as desired (e.g., "YYYY-MM-DD hh:mm:ss")
    //    const formattedDate = localDate.toLocaleString('en-US', {
    //     timeZone: 'America/Chicago', // Timezone for Central Time (CT)
    //     year: 'numeric',
    //     month: '2-digit',
    //     day: '2-digit',
    //     hour: '2-digit',
    //     minute: '2-digit',
    //     second: '2-digit'
    // });

    // Manually format the local date as desired
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const year = localDate.getFullYear();
    const hours = String(localDate.getHours() % 12 || 12).padStart(2, '0');
    const minutes = String(localDate.getMinutes()).padStart(2, '0');
    const seconds = String(localDate.getSeconds()).padStart(2, '0');
    const ampm = localDate.getHours() >= 12 ? 'PM' : 'AM';
  
    const formattedDate = `${month}/${day}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
  
    return formattedDate;
}

function createTable() {
    const table = document.createElement('table');
    table.classList.add('slp-table');
    return table;
}

function appendTable(table) {
    const tableContainer = document.getElementById('tableContainer');
    tableContainer.appendChild(table);
}

function calculateGameLength(latestFrame) {
    let totalFrames = latestFrame.frame;
    totalFrames += 120 // add two seconds for Ready Go
    const totalSeconds = totalFrames / 60;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return `${minutes}m${seconds}s`;
}

function findFilesInDir(startPath, filter, fileOrder) {
    var results = [];

    if (!existsSync(startPath)){
        console.log("no dir ",startPath);
        return;
    }

    var files = readdirSync(startPath);
    
    if (fileOrder === 'Descending') { // most recent first
        files.sort((a, b) => {
            const statA = lstatSync(join(startPath, a));
            const statB = lstatSync(join(startPath, b));
            return statB.mtime.getTime() - statA.mtime.getTime();
        });
    } else if (fileOrder === 'Ascending') {
        files.sort((a, b) => {
            const statA = lstatSync(join(startPath, a));
            const statB = lstatSync(join(startPath, b));
            return statA.mtime.getTime() - statB.mtime.getTime();
        });
    }

    for(var i = 0; i < files.length; i++){
        var filename = join(startPath, files[i]);
        var stat = lstatSync(filename);
        
        // find files in subfolders
        if (stat.isDirectory()){
            results = results.concat(findFilesInDir(filename, filter, fileOrder)); //recurse
        }
        else if (filename.indexOf(filter) >= 0) {
            console.log('-- found: ',filename);
            results.push(filename);
        }
    }
    
    return results;
}

function createCollapsibleSection(metadata, settings, gameEnd, latestFrame, stockCounts) {
    if (metadata && settings) {
        const collapsibleDiv = document.createElement('div');
        collapsibleDiv.classList.add('collapsible');

        const headerDiv = document.createElement('div');
        headerDiv.classList.add('collapsible-header');

        const stageId = settings.stageId;
        const stagePath = getStagePath(stageId);
        
        const stageImage = document.createElement('img');
        stageImage.src = stagePath;
        stageImage.classList.add('stage-image');
        
        // Apply styles to the header div
        headerDiv.style.overflow = 'hidden'; // Hide any overflow content
        headerDiv.style.position = 'relative'; // Set position to relative to contain absolute-positioned elements
        
        headerDiv.appendChild(stageImage);

        let winningTeamColor = null;

        if (gameEnd != null && gameEnd.gameEndMethod === 3) {
            stockCounts.forEach((stocksRemaining, index) => {
                if (stocksRemaining > 0) {
                    winningTeamColor = TeamColors[settings.players[index].teamId].toLowerCase();
                }
            });
        }

        // Construct header text with date, time, Connect Code, and stage
        const connectCodes = settings.players.map((player, index) => {
            let teamColorClass = `team-${TeamColors[player.teamId].toLowerCase()}`;
            const connectCode = player.connectCode;

            if (gameEnd != null) { // null === game crashed
                switch (gameEnd.gameEndMethod) {
                    case 3:
                        if (teamColorClass === ("team-" + winningTeamColor)) {
                            teamColorClass += '-winner';
                        }
                        break;
                    case 7:
                        if (isLRASInitiator(gameEnd, index)) {
                            teamColorClass += '-faded'; // Add 'faded' class if the player is the LRAS initiator
                        }
                        break;
                    default:
                        console.log(metadata.startAt + " Unknown gameEnd.gameEndMethod: " + gameEnd.gameEndMethod);
                        break;
                }
            }

            // Get the character icon path
            const characterId = player.characterId;
            const color = player.characterColor;
            const characterIconPath = getCharacterIconPath(characterId, color);

            // Create an image element for the character icon
            const characterIconImg = document.createElement('img');
            characterIconImg.src = characterIconPath;
            characterIconImg.classList.add('character-icon');

            // Create a span for the connect code
            const connectCodeSpan = document.createElement('span');
            connectCodeSpan.classList.add('connect-code', teamColorClass);

            // Connect code font weight: <b>ZAP</b>#151
            const [prefix, suffix] = connectCode.split('#');

            const prefixSpan = document.createElement('span');
            prefixSpan.style.fontWeight = 'bold';
            prefixSpan.textContent = prefix;

            const suffixSpan = document.createElement('span');
            suffixSpan.style.fontWeight = 'normal';
            suffixSpan.textContent = `#${suffix}`;

            // Append the parts to the connect code span
            connectCodeSpan.appendChild(prefixSpan);
            connectCodeSpan.appendChild(suffixSpan);

            // Concatenate the character icon and connect code
            const playerInfoSpan = document.createElement('span');
            playerInfoSpan.appendChild(characterIconImg);
            playerInfoSpan.appendChild(connectCodeSpan);

            return playerInfoSpan;
        });

        const timestamp = convertUTCtoLocalTime(metadata.startAt, 'CT');
        headerDiv.setAttribute('data-timestamp', timestamp); // to retrieve in sortDropdown

        const stage = stages.getStageName(settings.stageId);
        const gamelength = calculateGameLength(latestFrame);
        const gamelengthSeconds = parseGameLength(gamelength);
        const gamelengthPercentage = (gamelengthSeconds / (8 * 60)) * 100; // Calculate percentage of game length out of 8 minutes
        headerDiv.setAttribute('data-length', gamelengthSeconds); // to sort by shortest/longest in sortDropdown

        // Create elements for timestamp, stage, and gamelength
        const timestampSpan = document.createElement('span');
        timestampSpan.textContent = timestamp;
        timestampSpan.classList.add('small-text');

        const stageSpan = document.createElement('span');
        stageSpan.textContent = stage;
        stageSpan.classList.add('small-text');

        const gamelengthSpan = document.createElement('span');
        gamelengthSpan.textContent = gamelength;
        gamelengthSpan.classList.add('small-text');

        const timerIcon = createTimerIcon(gamelengthPercentage);

        // Create a container for player info
        const playerInfoContainer = document.createElement('div');
        playerInfoContainer.classList.add('player-info-container');
        connectCodes.forEach(connectCodeSpan => {
            playerInfoContainer.appendChild(connectCodeSpan);
        });

        // Create a container for timestamp, stage, and gamelength
        const gameInfoContainer = document.createElement('div');
        gameInfoContainer.classList.add('game-info-container');
        gameInfoContainer.appendChild(timestampSpan);
        gameInfoContainer.appendChild(timerIcon);
        gameInfoContainer.appendChild(gamelengthSpan);
        gameInfoContainer.appendChild(stageSpan);

        // Create a container for header content
        const headerContainer = document.createElement('div');
        headerContainer.classList.add('header-container');
        headerContainer.appendChild(playerInfoContainer);
        headerContainer.appendChild(gameInfoContainer);

        // Append header content to the headerDiv
        headerDiv.appendChild(headerContainer);

        const bodyDiv = document.createElement('div');
        bodyDiv.classList.add('collapsible-body');

        const table = createTable();
        bodyDiv.appendChild(table);

        collapsibleDiv.appendChild(headerDiv);
        collapsibleDiv.appendChild(bodyDiv);

        return collapsibleDiv;
    } else {
        return null;
    }
}

function parseGameLength(gamelength) {
    const [minutes, seconds] = gamelength.split('m');
    return parseInt(minutes) * 60 + parseInt(seconds.replace('s', ''));
}

function isLRASInitiator(gameEnd, playerIndex) {
    return parseInt(gameEnd.lrasInitiatorIndex) === playerIndex;
}

function createTimerIcon(gamelengthPercentage) {
    const timerIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    timerIcon.setAttribute('class', 'timer-icon');
    timerIcon.setAttribute('viewBox', '0 0 100 100');
    timerIcon.setAttribute('width', '20');
    timerIcon.setAttribute('height', '20');

    const timerBackground = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    timerBackground.setAttribute('cx', '50');
    timerBackground.setAttribute('cy', '50');
    timerBackground.setAttribute('r', '40');
    timerBackground.setAttribute('stroke', '#ddd');
    timerBackground.setAttribute('stroke-width', '10');
    timerBackground.setAttribute('fill', 'none');

    const timerProgress = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const angle = (gamelengthPercentage / 100) * 360; // Calculate angle based on percentage
    const largeArcFlag = angle > 180 ? 1 : 0; // Set the largeArcFlag depending on angle
    const x = 50 + 40 * Math.cos(Math.PI * (90 - angle) / 180); // Calculate the end point of the arc
    const y = 50 - 40 * Math.sin(Math.PI * (90 - angle) / 180); // Calculate the end point of the arc
    const pathData = `M50,50 L50,10 A40,40 0 ${largeArcFlag},1 ${x},${y} Z`; // Construct the path data
    timerProgress.setAttribute('d', pathData);
    timerProgress.setAttribute('fill', '#FFFFFF');

    timerIcon.appendChild(timerBackground);
    timerIcon.appendChild(timerProgress);

    return timerIcon;
}

function appendCollapsibleSection(section) {
    const container = document.getElementById('collapsibleContainer');
    container.appendChild(section);
}

async function computeStats(gameFile, totalFiles, singlesChecked, startDate, endDate) {
    const game = new SlippiGame(gameFile);
    const settings = game.getSettings();

    if (singlesChecked && !settings.isTeams) {
        console.log(`'${gameFile}': singles game when ignoreSingles is checked.`);
        return 'skipped';
    }

    const metadata = game.getMetadata();
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

    // Create a collapsible container for this file's output
    const collapsibleSection = createCollapsibleSection(metadata, settings, gameEnd, latestFrame, stockCounts);

    // Check if collapsibleSection is not null or undefined
    if (collapsibleSection) {
        appendCollapsibleSection(collapsibleSection); // Append collapsible section to container

        // Get the body of the collapsible section
        const collapsibleBody = collapsibleSection.querySelector('.collapsible-body');

        const table = createTable();

        const labelRow = table.insertRow();
        const filePath = game.getFilePath();
        const fileName = filePath.split('\\').pop(); // Assuming the path separator is '\' (backslash)
        
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

function saveSelectedFolderToLocalStorage(folderPath) {
    if (folderPath === null) {
        localStorage.removeItem('selectedFolder'); // Remove the key if folderPath is null
    } else {
        localStorage.setItem('selectedFolder', folderPath);
    }
}

// Function to retrieve selected folder path from localStorage
function getSelectedFolderFromLocalStorage() {
    return localStorage.getItem('selectedFolder') || '(Select Folder)';
}

// Event listener for the open folder button
document.getElementById('openFolderButton').addEventListener('click', () => {
    // Check if a folder is selected
    const selectedFolder = getSelectedFolderFromLocalStorage();
    if (!selectedFolder || selectedFolder === null || selectedFolder === "null") {
        alert('Choose a folder first. (Select Folder)');
        return;
    }
    
    // Open the selected folder on the user's machine
    ipcRenderer.send('open-folder', selectedFolder);
});

// Listen for the response from main process to open folder
ipcRenderer.on('folder-opened', (event, message) => {
    console.log(message);
});

document.getElementById('selectFolderButton').addEventListener('click', () => {
    ipcRenderer.send('select-folder-dialog');
});

// Listen for the selected directory from main process
ipcRenderer.on('selected-directory', (event, folderPath) => {
    console.log('Selected directory:', folderPath);
    saveSelectedFolderToLocalStorage(folderPath);
});

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

function showLoadingIcon() {
    document.getElementById('loading-icon').style.display = 'flex';
}

function hideLoadingIcon() {
    document.getElementById('loading-icon').style.display = 'none';
}

async function processFiles() {
    // Check if a folder is selected
    const selectedFolder = getSelectedFolderFromLocalStorage();
    console.log("Selected folder: " + selectedFolder)
    if (!selectedFolder || selectedFolder === null || selectedFolder === "null") {
        console.log('Please select a folder first.');
        alert('Choose a folder first. (Select Folder)');
        return;
    }

    showLoadingIcon(); 

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
            console.log('Invalid custom file count. Please enter a valid number.');
            alert('Invalid custom file count. Please enter a valid number.');
            return;
        }
    } else {
        // Assume a specific number is selected
        totalFiles = parseInt(selectedFileCount);
    }

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
    const message = document.createElement('div');
    message.classList.add('message');
    message.textContent = filesProcessed + (filesProcessed === 1 ? ' file' : ' files') + ' processed.';
    document.body.appendChild(message);

    hideLoadingIcon();

    // Remove the message after 5 seconds
    setTimeout(() => {
        document.body.removeChild(message);
    }, 5000);

    loadingBar.style.width = '100%';
    // Hide loading text and bar when done
    loadingText.style.display = 'none';
}

// Event listener for the start button
document.getElementById('startButton').addEventListener('click', processFiles);

// Event listener for the refresh button
document.getElementById('refreshButton').addEventListener('click', () => {
    // Reload the page
    window.location.reload();
});

document.addEventListener('click', function(event) {
    if (event.target.classList.contains('collapsible-header')) {
        const collapsibleBody = event.target.nextElementSibling;
        collapsibleBody.classList.toggle('show');
    }
});

document.getElementById('expandCollapseButton').addEventListener('click', function() {
    const collapsibleBodies = document.querySelectorAll('.collapsible-body');
    let allExpanded = true;

    // Check if all collapsibles are already expanded
    collapsibleBodies.forEach(body => {
        if (!body.classList.contains('show')) {
            allExpanded = false;
            return;
        }
    });

    // Expand or collapse all collapsibles based on their current state
    collapsibleBodies.forEach(body => {
        if (!allExpanded) {
            body.classList.add('show');
        } else {
            body.classList.remove('show');
        }
    });
});

function displayProcessingOptions() {
    // const fileCountSelect = document.querySelector('input[name="fileCount"]:checked');
    // const fileOrderSelect = document.querySelector('input[name="fileOrder"]:checked');
    // const selectedFolder = getSelectedFolderFromLocalStorage();
    // const processingOptionsText = document.getElementById('processingOptionsText');

    // // Display selected folder or prompt to select folder if none is selected
    // if (selectedFolder) {
    //     processingOptionsText.textContent = `Process ${fileCountSelect.value} ${fileCountSelect.value === 'ALL' ? '' : fileOrderSelect.value} files in the directory (${selectedFolder}).`;
    // } else {
    //     processingOptionsText.textContent = 'Select a folder to process files.';
    // }
}

function sortAndRearrangeCollapsibles(option) {
    // Retrieve the container elements
    const collapsibleContainer = document.getElementById('collapsibleContainer');
    const tableContainer = document.getElementById('tableContainer');

    // Retrieve the DOM elements representing the collapsibles and their tables
    const collapsibles = collapsibleContainer.querySelectorAll('.collapsible-header');

    // Convert NodeList to array for easier manipulation
    const collapsiblesArray = Array.from(collapsibles);

    switch (option) {
        case 'Ascending':
            collapsiblesArray.sort((a, b) => {
                const timestampA = Date.parse(a.getAttribute('data-timestamp'));
                const timestampB = Date.parse(b.getAttribute('data-timestamp'));
                return timestampA - timestampB;
            });
            break;
    
        case 'Descending':
            collapsiblesArray.sort((a, b) => {
                const timestampA = Date.parse(a.getAttribute('data-timestamp'));
                const timestampB = Date.parse(b.getAttribute('data-timestamp'));
                return timestampB - timestampA;
            });
            break;
    
        case 'Longest':
            collapsiblesArray.sort((a, b) => {
                const lengthA = parseInt(a.getAttribute('data-length'), 10);
                const lengthB = parseInt(b.getAttribute('data-length'), 10);
                return lengthB - lengthA;
            });
            break;
    
        case 'Shortest':
            collapsiblesArray.sort((a, b) => {
                const lengthA = parseInt(a.getAttribute('data-length'), 10);
                const lengthB = parseInt(b.getAttribute('data-length'), 10);
                return lengthA - lengthB;
            });
            break;
    
        default:
            console.warn('Unknown sorting option:', option);
            break;
    }
    
    // Clear the container elements
    collapsibleContainer.innerHTML = '';
    tableContainer.innerHTML = '';

    // Append the sorted collapsibles and tables back to their respective containers
    collapsiblesArray.forEach(collapsible => {
        collapsibleContainer.appendChild(collapsible.parentNode); // Append the parent node to maintain the collapsible structure
    });
}

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM content loaded");

    // Display processing options when the page is loaded
    // displayProcessingOptions();

    const allFilesRadio = document.getElementById('allFiles');
    const customFilesRadio = document.getElementById('customFiles');
    const customFileCountInput = document.getElementById('customFileCount');
    const fileCountSelect = document.querySelector('input[name="fileCount"]:checked');
    const fileOrderSelect = document.querySelector('input[name="fileOrder"]:checked');
    const decrementBtn = document.querySelector('.decrement-btn');
    const incrementBtn = document.querySelector('.increment-btn');

    // Event listener for radio button change
    allFilesRadio.addEventListener('change', function() {
        console.log("ALL radio button clicked");
        customFileCountInput.style.display = 'none';
        customFileCountInput.value = ''; // Clear the value
        decrementBtn.style.display = 'none';
        incrementBtn.style.display = 'none';
        // displayProcessingOptions(); // Update processing options
    });
    
    customFilesRadio.addEventListener('change', function() {
        customFileCountInput.style.display = 'inline-block';
        customFileCountInput.focus();
        decrementBtn.style.display = 'inline-block';
        incrementBtn.style.display = 'inline-block';
    });

    decrementBtn.addEventListener('click', function() {
        if (customFileCountInput.value > 0) {
            customFileCountInput.value--;
        }
    });

    incrementBtn.addEventListener('click', function() {
        customFileCountInput.value++;
    });

    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const dateError = document.getElementById('dateError');

    // Function to validate the end date
    function validateEndDate() {
        const startDate = new Date(startDateInput.value);
        const endDate = new Date(endDateInput.value);
        if (endDate < startDate) {
            dateError.style.display = 'block';
            endDateInput.value = ''; // Clear the end date input
            return false;
        } else {
            dateError.style.display = 'none';
            return true;
        }
    }

    // Event listener for end date input change
    endDateInput.addEventListener('change', validateEndDate);

    // Add event listeners to sorting options
    document.getElementById('mostRecentOption').addEventListener('click', function() {
        sortAndRearrangeCollapsibles('Descending');
        document.getElementById('sortDropdown').classList.remove('show');
    });

    document.getElementById('leastRecentOption').addEventListener('click', function() {
        sortAndRearrangeCollapsibles('Ascending');
        document.getElementById('sortDropdown').classList.remove('show');
    });

    document.getElementById('longestOption').addEventListener('click', function() {
        sortAndRearrangeCollapsibles('Longest');
        document.getElementById('sortDropdown').classList.remove('show');
    });

    document.getElementById('shortestOption').addEventListener('click', function() {
        sortAndRearrangeCollapsibles('Shortest');
        document.getElementById('sortDropdown').classList.remove('show');
    });

    const aboutModal = document.getElementById('about-modal');
    const closeButton = document.querySelector('.close');

    let scrollPosition = 0; // Variable to store scroll position

    // Show the modal when the link is clicked
    document.getElementById('about-link-text').addEventListener('click', function() {
        scrollPosition = window.pageYOffset || document.documentElement.scrollTop; // Store current scroll position
        aboutModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent scrolling of the background content
    });

    // Close the modal when the close button is clicked
    closeButton.addEventListener('click', function() {
        aboutModal.style.display = 'none';
        document.body.style.overflow = ''; // Allow scrolling of the background content
        window.scrollTo(0, scrollPosition); // Restore scroll position
    });

    // Close the modal when the user clicks outside of it
    window.addEventListener('click', function(event) {
        if (event.target == aboutModal) {
            aboutModal.style.display = 'none';
            document.body.style.overflow = ''; // Allow scrolling of the background content
            window.scrollTo(0, scrollPosition); // Restore scroll position
        }
    });

    const twitterLink = document.getElementById('twitter-link');

    twitterLink.addEventListener('contextmenu', function(event) {
        event.preventDefault(); // Prevent the default right-click menu
        navigator.clipboard.writeText(this.href); // Copy the link to the clipboard
        alert('Twitter link copied!\n https://twitter.com/buddyboom_');
    });
});
