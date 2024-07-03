const { TeamColors } = require('./constants.js');
const { convertUTCtoLocalTime, getCharacterIconPath } = require('./utils.js');

function createCollapsibleSection(metadata, settings, gameEnd, latestFrame, stockCounts, filePath) {
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
                    case 3: // GAME! team battle
                        if (teamColorClass === ("team-" + winningTeamColor)) {
                            teamColorClass += '-winner';
                        }
                        break;
                    case 7: // No Contest
                        if (isLRASInitiator(gameEnd, index)) {
                            teamColorClass += '-faded'; // Add 'faded' class if the player is the LRAS initiator
                        }
                        break;
                    default:
                        // case 2: GAME! free for all (I think)
                        // case ?: timeout
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

            return {playerInfoSpan, connectCode};
        });

        // Add connect codes to the collapsible header as a data attribute
        headerDiv.dataset.connectCodes = JSON.stringify(connectCodes.map(info => info.connectCode));

        // Append player info spans to the header
        connectCodes.forEach(info => {
            headerDiv.appendChild(info.playerInfoSpan);
        });

        const timestamp = convertUTCtoLocalTime(metadata.startAt, 'CT');
        headerDiv.setAttribute('data-timestamp', timestamp); // to retrieve in sortDropdown

        const stage = stages.getStageName(settings.stageId);
        const gamelength = calculateGameLength(latestFrame);
        const gamelengthSeconds = parseGameLength(gamelength);
        const gamelengthPercentage = (gamelengthSeconds / (8 * 60)) * 100; // Calculate percentage of game length out of 8 minutes
        const timerIcon = createTimerIcon(gamelengthPercentage);
        headerDiv.setAttribute('data-gamelength', gamelengthSeconds); // to sort by shortest/longest in sortDropdown

        // Create elements for timestamp, stage, and gamelength
        const timestampSpan = document.createElement('span');
        timestampSpan.textContent = truncateSeconds(timestamp);
        timestampSpan.classList.add('small-text');

        const stageSpan = document.createElement('span');
        stageSpan.textContent = stage;
        stageSpan.classList.add('small-text');

        const gamelengthSpan = document.createElement('span');
        gamelengthSpan.textContent = gamelength;
        gamelengthSpan.classList.add('small-text');

        const fileNameSpan = createFileNameSpan(filePath);

        const playIcon = createPlayIcon(filePath);

        const flexSpacer = document.createElement('div');
        flexSpacer.classList.add('flex-spacer');

        const playerInfoContainer = document.createElement('div');
        playerInfoContainer.classList.add('player-info-container');
        connectCodes.forEach(info => {
            playerInfoContainer.appendChild(info.playerInfoSpan);
        });

        const gameInfoContainer = document.createElement('div');
        gameInfoContainer.classList.add('game-info-container');
        gameInfoContainer.appendChild(timestampSpan);
        gameInfoContainer.appendChild(timerIcon);
        gameInfoContainer.appendChild(gamelengthSpan);
        gameInfoContainer.appendChild(stageSpan);
        
        gameInfoContainer.appendChild(flexSpacer); // push fileNameSpan to right

        gameInfoContainer.appendChild(fileNameSpan);

        // Create a container for header content
        const headerContainer = document.createElement('div');
        headerContainer.classList.add('header-container');
        headerContainer.appendChild(playerInfoContainer);
        headerContainer.appendChild(gameInfoContainer);
        headerContainer.appendChild(playIcon); 

        // Append header content to the headerDiv
        headerDiv.appendChild(headerContainer);

        const bodyDiv = document.createElement('div');
        bodyDiv.classList.add('collapsible-body');

        collapsibleDiv.appendChild(headerDiv);
        collapsibleDiv.appendChild(bodyDiv);

        return collapsibleDiv;
    } else {
        return null;
    }
}

// Function to handle input and highlight matching columns
function highlightMatchingColumns() {
    const input = document.getElementById('connectCodeInput').value.trim().toUpperCase();

    const collapsibleSections = document.querySelectorAll('.collapsible');

    collapsibleSections.forEach((section, sectionIndex) => {
        const header = section.querySelector('.collapsible-header');
        const body = section.querySelector('.collapsible-body');
        const table = body ? body.querySelector('.slp-table') : null;

        if (!header || !body || !table) {
            console.log('Skipping section due to missing elements. Header:', !!header, 'Body:', !!body, 'Table:', !!table);
            return; // Skip this section if any of the required elements are missing
        }

        if(!input) {
            console.log('highlightMatchingColumns: Input is blank');
            return;
        }

        const connectCodes = JSON.parse(header.dataset.connectCodes);

        // Reset previous highlights
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
            cell.classList.remove('highlight');
        });

        // Check for match and highlight column if found
        if (connectCodes.includes(input)) {
            console.log('Match found for input:', input);
            const columnIndex = connectCodes.indexOf(input) + 1; // +1 to account for table headers

            // Try different ways to select rows
            const tbody = table.querySelector('tbody');
            if (!tbody) {
                console.log('No tbody found in the table.');
                return;
            }

            const rows = tbody.querySelectorAll('tr');

            rows.forEach((row, rowIndex) => {
                // Ensure there are enough cells in the row to access the desired column
                if (row.children.length > columnIndex) {
                    const cell = row.children[columnIndex];
                    if (cell) {
                        cell.classList.add('highlight');
                    } else {
                        console.log(`No cell found in row ${rowIndex} at column ${columnIndex}`);
                    }
                } else {
                    console.log(`Row ${rowIndex} does not have a column ${columnIndex}`);
                }
            });
        } else {
            console.log('No match found for input:', input);
        }
    });
}

const getStagePath = (stageId) => {
    const stagePng = path.join(__dirname, `../../images/stages/${stageId}.png`);
    return stagePng;
};

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

function createFileNameSpan(filePath) {
    const fileName = filePath.split('\\').pop(); // Assuming the path separator is '\' (backslash)
    const fileNameSpan = document.createElement('span');
    fileNameSpan.textContent = fileName;
    fileNameSpan.classList.add('small-text', 'file-name-span');
    fileNameSpan.style.marginRight = '5px';

    fileNameSpan.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent the event from propagating to the collapsible header
        shell.showItemInFolder(filePath);
    });

    return fileNameSpan;
}

function createPlayIcon(filePath) {
    const playIcon = document.createElement('div');
        playIcon.classList.add('play-icon');

    // Add click event to open the file
    playIcon.addEventListener('click', (event) => {
        event.stopPropagation(); // Prevent the event from propagating to the collapsible header
        shell.openPath(filePath)
            .then(result => {
                if (result) {
                    console.error('Failed to open file:', result);
                }
            })
            .catch(err => {
                console.error('Error opening file:', err);
            });
    });

    return playIcon;
}

function appendCollapsibleSection(section) {
    const container = document.getElementById('collapsibleContainer');
    container.appendChild(section);
}

function calculateGameLength(latestFrame) {
    let totalFrames = latestFrame.frame;
    totalFrames += 120 // add two seconds for Ready Go
    const totalSeconds = totalFrames / 60;

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);

    return `${minutes}m${seconds}s`;
}

function parseGameLength(gamelength) {
    const [minutes, seconds] = gamelength.split('m');
    return parseInt(minutes) * 60 + parseInt(seconds.replace('s', ''));
}

function isLRASInitiator(gameEnd, playerIndex) {
    return parseInt(gameEnd.lrasInitiatorIndex) === playerIndex;
}

function truncateSeconds(timestamp) {
    const [date, time, period] = timestamp.split(' ');
    const [hours, minutes] = time.split(':');
    return `${date} ${hours}:${minutes} ${period}`;
}

module.exports = {
    createCollapsibleSection,
    highlightMatchingColumns,
    appendCollapsibleSection
};