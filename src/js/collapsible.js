const { TeamColors } = require('./constants.js');
const { convertUTCtoLocalTime, getCharacterIconPath } = require('./utils.js');
const { ProcessedFilesModule } = require('./processedFilesModule.js');

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

        let LRASplayerIndex;

        // Construct header text with date, time, Connect Code, and stage
        const connectCodes = settings.players.map((player, index) => {
            let teamColorClass = `team-${TeamColors[player.teamId].toLowerCase()}`;
            const connectCode = player.connectCode;

            // Add to player's oval yellow outline (winner) or faded (isLRASinitator) if applicable
            teamColorClass = applyGameEndClass(gameEnd, teamColorClass, winningTeamColor, index, isLRASInitiator, LRASplayerIndex);

            const characterIconImg = createCharacterIcon(player.characterId, player.characterColor);

            // Use the new function to create the connect code link
            const connectCodeLink = createConnectCodeLink(connectCode, teamColorClass);

            // Concatenate the character icon and connect code
            const playerInfoSpan = document.createElement('span');
            playerInfoSpan.appendChild(characterIconImg);
            playerInfoSpan.appendChild(connectCodeLink);

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
        const gamelengthPercentage = (gamelengthSeconds / (8 * 60)); // Calculate percentage of game length out of 8 minutes
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

        fileName = filePath.split('\\').pop()
        
        const analyzeSessionIcon = createAnalyzeSessionIcon(filePath);

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
        headerContainer.appendChild(analyzeSessionIcon);
        headerContainer.appendChild(playIcon); 

        // Append header content to the headerDiv
        headerDiv.appendChild(headerContainer);

        const bodyDiv = document.createElement('div');
        bodyDiv.classList.add('collapsible-body');

        collapsibleDiv.appendChild(headerDiv);
        collapsibleDiv.appendChild(bodyDiv);

        addGameDataToProcessedFiles(metadata.startAt, settings, gameEnd, stockCounts, filePath, stage, LRASplayerIndex)        

        return collapsibleDiv;
    } else {
        return null;
    }
}

function applyGameEndClass(gameEnd, teamColorClass, winningTeamColor, index, isLRASInitiator, LRASplayerIndex) {
    if (gameEnd != null) {
        switch (gameEnd.gameEndMethod) {
            case 3: // GAME! team battle
                if (teamColorClass === ("team-" + winningTeamColor)) {
                    teamColorClass += '-winner';
                }
                break;
            case 7: // No Contest
                if (isLRASInitiator(gameEnd, index)) {
                    teamColorClass += '-faded'; // Add 'faded' class if the player is the LRAS initiator
                    LRASplayerIndex = index; // TODO when i try 'return teamColorClass, LRASplayerIndex' both them become undefined
                    console.log('LRASplayerIndex: '+LRASplayerIndex);
                }
                break;
            default:
                console.log("Unknown gameEnd.gameEndMethod: " + gameEnd.gameEndMethod);
                break;
        }
    }
    return teamColorClass; // Return the modified teamColorClass
}

function createCharacterIcon(characterId, characterColor) {
    // Get the character icon path
    const characterIconPath = getCharacterIconPath(characterId, characterColor);

    // Create an image element for the character icon
    const characterIconImg = document.createElement('img');
    characterIconImg.src = characterIconPath;
    characterIconImg.classList.add('character-icon');

    return characterIconImg;
}

function createConnectCodeLink(connectCode, teamIdOrColorClass) {
    let teamColorClass;
    
    if (typeof teamIdOrColorClass === 'number') {
        // Use teamId to determine the color class
        teamColorClass = `team-${TeamColors[teamIdOrColorClass].toLowerCase()}`;
    } else {
        // Use teamColorClass directly
        teamColorClass = teamIdOrColorClass;
    }
    
    // Create an anchor element for the connect code
    const connectCodeLink = document.createElement('a');
    connectCodeLink.href = `https://slippi.gg/user/${connectCode.replace('#', '-')}`;
    connectCodeLink.target = '_blank'; // Open in new tab
    connectCodeLink.classList.add('external-link');

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

    // Append the connect code span to the anchor
    connectCodeLink.appendChild(connectCodeSpan);

    return connectCodeLink;
}

function addGameDataToProcessedFiles(startAt, settings, gameEnd, stockCounts, filePath, stage, LRASplayerIndex) {
    const gameData = {
        connectCodes: [],
        characterInfo: [],
        gameTimestamp: new Date(startAt),
        // stage: stage,
        stageId: settings.stageId,
        LRASplayer: '',
        winningTeamConnectCodes: [],
        losingTeamConnectCodes: []
    };
    
    const teams = {};

    settings.players.forEach((player, index) => {
        const connectCode = player.connectCode;
        const characterId = player.characterId;
        const color = player.characterColor;
        const teamId = player.teamId;

        // Add player connect code and character info
        gameData.connectCodes.push({ connectCode, port: index });
        gameData.characterInfo.push({ characterId, color, teamId });

        // Organize players by team
        if (!teams[teamId]) {
            teams[teamId] = [];
        }
        teams[teamId].push({ connectCode, stockCount: stockCounts[index] });
    });

    // Determine the winning team based on the remaining stocks
    console.log('addGameDataToProcessedFiles LRASplayerIndex: '+LRASplayerIndex);
    if (LRASplayerIndex) {
        gameData.LRASplayer = LRASplayerIndex;
    } else if (gameEnd && gameEnd.gameEndMethod === 3) {
        let winningTeamId = null;
        for (const teamId in teams) {
            const teamPlayers = teams[teamId];
            const hasRemainingStocks = teamPlayers.some(player => player.stockCount > 0);

            if (hasRemainingStocks) {
                winningTeamId = teamId;
                teamPlayers.forEach(player => {
                    gameData.winningTeamConnectCodes.push(player.connectCode);
                });
            }
        }

        // Determine losing team connect codes
        if (winningTeamId !== null) {
            for (const teamId in teams) {
                if (teamId !== winningTeamId) {
                    const teamPlayers = teams[teamId];
                    teamPlayers.forEach(player => {
                        gameData.losingTeamConnectCodes.push(player.connectCode);
                    });
                }
            }
        }
    }

    fileName = filePath.split('\\').pop();
    ProcessedFilesModule.addProcessedFile(fileName, gameData);
    // console.log(ProcessedFilesModule.getSortedProcessedFiles());

    // Log the gameData for verification
    console.log(gameData);
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
    const angle = gamelengthPercentage * 360; // Calculate angle based on percentage
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

function createAnalyzeSessionIcon(filePath) {
    const { analyzeSession } = require('./stats.js'); // Dynamically require to avoid circular dependency

    // Create the main analyze session icon container
    const analyzeSessionIcon = document.createElement('div');
    analyzeSessionIcon.classList.add('analyze-session-icon');

    // Create the magnifying glass circle (use the ::before style)
    const magnifyingGlass = document.createElement('div');
    magnifyingGlass.classList.add('magnifying-glass');
    analyzeSessionIcon.appendChild(magnifyingGlass);

    // Add the handle of the magnifying glass (use the ::after style)
    const handle = document.createElement('div');
    handle.classList.add('handle');
    analyzeSessionIcon.appendChild(handle);

    // Create the container for the mini bar graph inside the magnifying glass
    const barGraph = document.createElement('div');
    barGraph.classList.add('bar-graph');

    // Add the individual bars to the bar graph
    const bar1 = document.createElement('div');
    bar1.classList.add('bar');
    barGraph.appendChild(bar1);

    const bar2 = document.createElement('div');
    bar2.classList.add('bar');
    barGraph.appendChild(bar2);

    const bar3 = document.createElement('div');
    bar3.classList.add('bar');
    barGraph.appendChild(bar3);

    // Append the bar graph to the magnifying glass
    analyzeSessionIcon.appendChild(barGraph);

    // Add event listener for the click event to trigger the analyzeSession function
    analyzeSessionIcon.addEventListener('click', (event) => {
        const sessionData = analyzeSession(filePath);

        if (sessionData) {
            createSessionModal(sessionData);
        }
    });

    return analyzeSessionIcon;
}


function appendCollapsibleSection(section) {
    const container = document.getElementById('collapsibleContainer');
    container.appendChild(section);
}

function calculateGameLength(latestFrame) {
    if(latestFrame != null) {
        let totalFrames = latestFrame.frame;
        totalFrames += 120 // add two seconds for Ready Go
        const totalSeconds = totalFrames / 60;

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);

        return `${minutes}m${seconds}s`;
    }
    return '0m0s';
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

function createSessionModal(sessionData) {
    // Create modal background and container as before
    const modalBackground = document.createElement('div');
    modalBackground.classList.add('modal-background');
    
    const modal = document.createElement('div');
    modal.classList.add('session-modal');

    const modalHeader = document.createElement('div');
    modalHeader.classList.add('modal-header');
    
    const closeButton = document.createElement('button');
    closeButton.textContent = "Close";
    closeButton.classList.add('close-button');
    closeButton.addEventListener('click', () => {
        document.body.removeChild(modalBackground);
    });
    modalHeader.appendChild(closeButton);
    modal.appendChild(modalHeader);

    // Close modal when clicking outside of it
    modalBackground.addEventListener('click', (event) => {
        if (event.target === modalBackground) {
            document.body.removeChild(modalBackground);
        }
    });
    
    // Optionally, you can also close the modal when pressing the Escape key
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            document.body.removeChild(modalBackground);
        }
    });

    const sessionTitleContainer = document.createElement('div');
    sessionTitleContainer.classList.add('session-title-container');

    
    const uniqueConnectCodes = [...new Set(sessionData.connectCodes)];
    const sessionTitle = document.createElement('h1');
    sessionTitle.textContent = `Session: ${uniqueConnectCodes.join(' ')}`;
    sessionTitleContainer.appendChild(sessionTitle);
    modal.appendChild(sessionTitleContainer);

    const playerInfoContainer = document.createElement('div');

    console.log(sessionData);
    
    // Helper function to convert color to teamId
    const colorToTeamId = (color) => {
        switch (color) {
            case '#F15959': return 0; // Red
            case '#6565FE': return 1; // Blue
            case '#4CE44C': return 2; // Green
            default: return null;     // Handle unexpected colors
        }
    };

    Object.entries(sessionData.overallRecord).forEach(([team, opponents]) => {
        const teamInfoDiv = document.createElement('div');
    
        Object.entries(opponents).forEach(([opponent, record]) => {
            const overallRecordDiv = document.createElement('div');
            overallRecordDiv.classList.add('overall-record-info');
    
            const totalGames = record.wins + record.losses;
            const winPercentage = (record.wins / totalGames) * 100;
            const lossPercentage = (record.losses / totalGames) * 100;
    
            const barWrapper = document.createElement('div');
            barWrapper.classList.add('percentage-bar');
    
            // Assign colors to the left and right teams
            const leftTeamColor = record.teamColors.leftTeamColor;
            const rightTeamColor = record.teamColors.rightTeamColor;
    
            const leftBar = document.createElement('div');
            leftBar.style.width = `${winPercentage}%`;
            leftBar.style.backgroundColor = leftTeamColor;
    
            const rightBar = document.createElement('div');
            rightBar.style.width = `${lossPercentage}%`;
            rightBar.style.backgroundColor = rightTeamColor;
    
            // Append the bars to the bar wrapper
            barWrapper.appendChild(leftBar);
            barWrapper.appendChild(rightBar);
    
            // Split the team and opponent strings to generate the connect code ovals
            const teamConnectCodes = team.split(',');
            const opponentConnectCodes = opponent.split(',');
    
            // Create spans for the teams with clickable ovals for the connect codes

            const leftTeamId = colorToTeamId(leftTeamColor);
            const rightTeamId = colorToTeamId(rightTeamColor);

            // Left team connect code ovals (teamConnectCodes corresponds to the left team)
            const teamSpans = document.createElement('span');
            teamConnectCodes.forEach(connectCode => {
                // Use the leftTeamColor for the left team ovals
                const connectCodeLink = createConnectCodeLink(connectCode, leftTeamId);
                teamSpans.appendChild(connectCodeLink);
            });
    
            // Right team connect code ovals (opponentConnectCodes corresponds to the right team)
            const opponentSpans = document.createElement('span');
            opponentConnectCodes.forEach(connectCode => {
                // Use the rightTeamColor for the right team ovals
                const connectCodeLink = createConnectCodeLink(connectCode, rightTeamId);
                opponentSpans.appendChild(connectCodeLink);
            });
    
            // Create a span for the record text
            const overallRecordSpan = document.createElement('span');
            overallRecordSpan.textContent = `${record.wins} - ${record.losses}`;

            // Create tooltip for win/loss percentage
            const tooltip = document.createElement('div');
            tooltip.classList.add('tooltip');
            tooltip.textContent = `${winPercentage.toFixed(0)}% / ${lossPercentage.toFixed(0)}%`;
            tooltip.style.display = 'none'; // Hide by default
            document.body.appendChild(tooltip);

            // Event listeners for tooltip
            overallRecordSpan.addEventListener('mouseenter', () => {
                tooltip.style.display = 'block';
                const rect = overallRecordSpan.getBoundingClientRect(); // Get the position of the recordSpan
                tooltip.style.left = `${rect.right + 10}px`; // Position to the right of the recordSpan
                tooltip.style.top = `${rect.top}px`; // Align vertically with the recordSpan
            });

            overallRecordSpan.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none'; // Hide on mouse leave
            });
    
            // Apply a class to the overall record text span
            overallRecordSpan.classList.add('record-text');
    
            // Rearranging the structure: First the bar, then teams + record in the same row
            overallRecordDiv.appendChild(barWrapper);  // Graphical bar at the top
    
            // Wrap team1, record, and team2 in a single row
            const recordAndTeamsDiv = document.createElement('div');
            recordAndTeamsDiv.classList.add('record-and-teams');
            
            recordAndTeamsDiv.appendChild(teamSpans);         // Add team1 connect code ovals (left team)
            recordAndTeamsDiv.appendChild(overallRecordSpan); // Add record in the center
            recordAndTeamsDiv.appendChild(opponentSpans);     // Add team2 connect code ovals (right team)
    
            overallRecordDiv.appendChild(recordAndTeamsDiv);  // Add the row with teams and record
    
            teamInfoDiv.appendChild(overallRecordDiv);
        });
    
        playerInfoContainer.appendChild(teamInfoDiv);
    });
    
    modal.appendChild(playerInfoContainer);

    // --- STAGE RECORDS ---
    const stageInfoContainer = document.createElement('div');
    stageInfoContainer.classList.add('stage-info-container');

    Object.entries(sessionData.stageRecords).forEach(([stageId, stageData]) => {
        const stageDiv = document.createElement('div');
        stageDiv.classList.add('stage-info');
    
        const stagePath = getStagePath(stageId);

        const stageImage = document.createElement('img');
        stageImage.src = stagePath;
        stageImage.classList.add('stage-image');

        stageDiv.appendChild(stageImage);

        const stageName = stages.getStageName(stageId);

        const stageTitle = document.createElement('h3');
        stageTitle.textContent = `${stageName}`;
        stageDiv.appendChild(stageTitle);
    
        Object.entries(stageData).forEach(([team, opponents]) => {
            const teamStageInfo = document.createElement('div');
            teamStageInfo.classList.add('team-stage-info');
    
            Object.entries(opponents).forEach(([opponent, record]) => {
                const overallRecordDiv = document.createElement('div');
                overallRecordDiv.classList.add('overall-record-info');

                const totalGames = record.wins + record.losses;
                const winPercentage = (record.wins / totalGames) * 100;
                const lossPercentage = (record.losses / totalGames) * 100;

                const barWrapper = document.createElement('div');
                barWrapper.classList.add('percentage-bar');

                const leftTeamColor = record.teamColors.leftTeamColor;  // Assign left team color
                const rightTeamColor = record.teamColors.rightTeamColor; // Assign right team color

                const leftBar = document.createElement('div');
                leftBar.style.width = `${winPercentage}%`; // LEFT bar represents win percentage
                leftBar.style.backgroundColor = leftTeamColor;

                const rightBar = document.createElement('div');
                rightBar.style.width = `${lossPercentage}%`; // RIGHT bar represents loss percentage
                rightBar.style.backgroundColor = rightTeamColor;

                // Get teamId from the left and right team colors
                const leftTeamId = colorToTeamId(leftTeamColor);
                const rightTeamId = colorToTeamId(rightTeamColor);

                const teamConnectCodes = team.split(',');
                const opponentConnectCodes = opponent.split(',');

                // Create spans for the teams with clickable ovals for the connect codes
                const teamSpans = document.createElement('span');
                teamConnectCodes.forEach(connectCode => {
                    const connectCodeLink = createConnectCodeLink(connectCode, leftTeamId); // Use leftTeamId
                    teamSpans.appendChild(connectCodeLink);
                });

                const opponentSpans = document.createElement('span');
                opponentConnectCodes.forEach(connectCode => {
                    const connectCodeLink = createConnectCodeLink(connectCode, rightTeamId); // Use rightTeamId
                    opponentSpans.appendChild(connectCodeLink);
                });

                const recordText = `${record.wins} - ${record.losses}`;

                const overallRecordSpan = document.createElement('span');
                overallRecordSpan.textContent = recordText;
                overallRecordSpan.classList.add('record-text'); // Add the record-text class
                
                // Create tooltip for win/loss percentage
                const tooltip = document.createElement('div');
                tooltip.classList.add('tooltip');
                tooltip.textContent = `${winPercentage.toFixed(0)}% / ${lossPercentage.toFixed(0)}%`;
                tooltip.style.display = 'none'; // Hide by default
                document.body.appendChild(tooltip);

                // Event listeners for tooltip
                overallRecordSpan.addEventListener('mouseenter', () => {
                    tooltip.style.display = 'block';
                    const rect = overallRecordSpan.getBoundingClientRect(); // Get the position of the recordSpan
                    tooltip.style.left = `${rect.right + 10}px`; // Position to the right of the recordSpan
                    tooltip.style.top = `${rect.top}px`; // Align vertically with the recordSpan
                });

                overallRecordSpan.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none'; // Hide on mouse leave
                });

                // Create a new div for team1, record, and team2 and add relevant elements
                const recordAndTeamsDiv = document.createElement('div');
                recordAndTeamsDiv.classList.add('record-and-teams');
                recordAndTeamsDiv.appendChild(teamSpans);         // Team 1 (left side)
                recordAndTeamsDiv.appendChild(overallRecordSpan); // Record (center)
                recordAndTeamsDiv.appendChild(opponentSpans);     // Team 2 (right side)

                barWrapper.appendChild(leftBar);
                barWrapper.appendChild(rightBar);
                overallRecordDiv.appendChild(barWrapper);
                overallRecordDiv.appendChild(recordAndTeamsDiv);  // Append the new div with team1, record, and team2
                teamStageInfo.appendChild(overallRecordDiv);
            });

    
            stageDiv.appendChild(teamStageInfo);
        });
    
        stageInfoContainer.appendChild(stageDiv);
    });
    
    modal.appendChild(stageInfoContainer);

    // --- CHARACTER COMBINATION RECORDS ---
    const characterCombinationTitle = document.createElement('h2');
    characterCombinationTitle.textContent = 'Character Combination Records';
    modal.appendChild(characterCombinationTitle);

    const characterCombinationContainer = document.createElement('div');
    characterCombinationContainer.classList.add('character-combination-records-container');

    const characterCombinationRecords = sessionData.characterCombinationRecords;

    function groupByTeamIdComposition(characterCombinationRecords) {
        const groupedByTeamIdComposition = {};

        Object.keys(characterCombinationRecords).forEach((combination) => {
            const parsedCombination = JSON.parse(combination);

            // Extract only the teamIds for each connect code
            const teamIds = Object.keys(parsedCombination).map(connectCode => parsedCombination[connectCode].teamId);

            // Convert the teamIds array into a string representation (e.g., "0011")
            const teamIdKey = teamIds.join('');

            // If this teamId composition has not been seen yet, initialize an array for it
            if (!groupedByTeamIdComposition[teamIdKey]) {
                groupedByTeamIdComposition[teamIdKey] = [];
            }

            // Push the combination and its corresponding data under the teamId key
            groupedByTeamIdComposition[teamIdKey].push({
                combination: combination,
                teamData: characterCombinationRecords[combination]
            });
        });

        return groupedByTeamIdComposition;
    }
    const groupedByTeamIdComposition = groupByTeamIdComposition(characterCombinationRecords);
    console.log(groupedByTeamIdComposition);

    // Now loop through the grouped games to display them
    Object.keys(groupedByTeamIdComposition).forEach(teamComposition => {
        // Create a div for each team composition group
        const teamCompositionDiv = document.createElement('div');
        teamCompositionDiv.classList.add('team-composition-group');

        // Create a header for the team composition (e.g., '0011' layout)
        const teamCompositionTitle = document.createElement('h4');
        teamCompositionTitle.textContent = `Team Layout: ${teamComposition}`;
        // teamCompositionDiv.appendChild(teamCompositionTitle);

        let counter = 0;

        // Loop through all the games within this team composition group
        groupedByTeamIdComposition[teamComposition].forEach(({ combination, teamData }) => {
            const combinationDiv = document.createElement('div');
            combinationDiv.classList.add('combination-record');
            
            // Set up the combination title (connectCodes)
            const combinationTitleDiv = document.createElement('div');
            combinationTitleDiv.classList.add('combination-title');

            // Parse the combination string into an object to access player info
            const parsedCombination = JSON.parse(combination);

            // Sort the teams alphabetically for consistency
            const connectCodes = Object.keys(parsedCombination);
            const leftTeam = connectCodes.filter(code => parsedCombination[code].teamId === 0 || parsedCombination[code].teamId === 2);
            const rightTeam = connectCodes.filter(code => parsedCombination[code].teamId === 1);
            const teams = [leftTeam, rightTeam].sort();
            const sortedLeftTeam = teams[0];
            const sortedRightTeam = teams[1];

            // Create a set of player ovals for the team composition, but only once. I could not think/find a better way to do this.
            if(counter == 0) {
                sortedLeftTeam.forEach(connectCode => {
                    const connectCodeLink = createConnectCodeLink(connectCode, parsedCombination[connectCode].teamId);
                    combinationTitleDiv.appendChild(connectCodeLink);        
                });
                sortedRightTeam.forEach(connectCode => {
                    const connectCodeLink = createConnectCodeLink(connectCode, parsedCombination[connectCode].teamId);
                    combinationTitleDiv.appendChild(connectCodeLink);
                });
                counter++;
                combinationDiv.appendChild(combinationTitleDiv);
            }

            // Get the records for each team combination
            Object.keys(teamData).forEach(leftTeam => {
                const rightTeam = Object.keys(teamData[leftTeam])[0]; // Assuming one right team entry
                const record = teamData[leftTeam][rightTeam];
                
                const totalGames = record.wins + record.losses;
                const winPercentage = (record.wins / totalGames) * 100;
                const lossPercentage = (record.losses / totalGames) * 100;

                const barWrapper = document.createElement('div');
                barWrapper.classList.add('percentage-bar');

                const isLeftTeamWinning = sortedLeftTeam.includes(leftTeam);

                // Assign colors based on sorted team order
                const leftTeamColor = record.teamColors.leftTeamColor;
                const rightTeamColor = record.teamColors.rightTeamColor;

                // Create the bars
                const leftBar = document.createElement('div');
                leftBar.style.width = `${winPercentage}%`;
                leftBar.style.backgroundColor = leftTeamColor;

                const rightBar = document.createElement('div');
                rightBar.style.width = `${lossPercentage}%`;
                rightBar.style.backgroundColor = rightTeamColor;

                barWrapper.appendChild(leftBar);
                barWrapper.appendChild(rightBar);

                // Create spans for teams with character icons
                const leftTeamSpans = document.createElement('span');
                const rightTeamSpans = document.createElement('span');

                const addPlayerIcon = (connectCode, characterInfo, span) => {
                    const characterId = characterInfo.characterId;
                    const color = characterInfo.color;

                    // Create the character icon and append it directly to the span
                    const characterIcon = createCharacterIcon(characterId, color);
                    span.appendChild(characterIcon);
                };

                // Add players to the appropriate team spans based on sorted layout
                sortedLeftTeam.forEach(connectCode => {
                    addPlayerIcon(connectCode, parsedCombination[connectCode], leftTeamSpans);
                });
                sortedRightTeam.forEach(connectCode => {
                    addPlayerIcon(connectCode, parsedCombination[connectCode], rightTeamSpans);
                });

                // Create a span for the record text
                const recordSpan = document.createElement('span');

                // Use proper logic to ensure the win-loss display is accurate
                // if (isLeftTeamWinning) {
                    recordSpan.textContent = `${record.wins} - ${record.losses}`; // Left team wins
                // } else {
                //     recordSpan.textContent = `${record.losses} - ${record.wins}`; // Right team wins
                // }

                recordSpan.classList.add('record-text');

                // Create tooltip for win/loss percentage
                const tooltip = document.createElement('div');
                tooltip.classList.add('tooltip');
                tooltip.textContent = `${winPercentage.toFixed(0)}% / ${lossPercentage.toFixed(0)}%`;
                tooltip.style.display = 'none'; // Hide by default
                document.body.appendChild(tooltip);

                // Event listeners for tooltip
                recordSpan.addEventListener('mouseenter', () => {
                    tooltip.style.display = 'block';
                    const rect = recordSpan.getBoundingClientRect(); // Get the position of the recordSpan
                    tooltip.style.left = `${rect.right + 10}px`; // Position to the right of the recordSpan
                    tooltip.style.top = `${rect.top}px`; // Align vertically with the recordSpan
                });

                recordSpan.addEventListener('mouseleave', () => {
                    tooltip.style.display = 'none'; // Hide on mouse leave
                });

                // Create a new div for team1, record, and team2 and add relevant elements
                const recordAndTeamsDiv = document.createElement('div');
                recordAndTeamsDiv.classList.add('record-and-teams');
                recordAndTeamsDiv.appendChild(leftTeamSpans);
                recordAndTeamsDiv.appendChild(recordSpan);
                recordAndTeamsDiv.appendChild(rightTeamSpans);

                // combinationDiv.appendChild(barWrapper);         // Graphical bar at the top
                combinationDiv.appendChild(recordAndTeamsDiv);  // Teams and record row
            });

            // Append the combinationDiv to the teamCompositionDiv
            teamCompositionDiv.appendChild(combinationDiv);
        });

        // Append the teamCompositionDiv to the container
        characterCombinationContainer.appendChild(teamCompositionDiv);
    });

    // Finally, append the characterCombinationContainer to the modal
    modal.appendChild(characterCombinationContainer);

    // --- STAGE AND CHARACTER RECORDS ---
    const stageCharacterTitle = document.createElement('h2');
    stageCharacterTitle.textContent = 'Stage Character Records';
    modal.appendChild(stageCharacterTitle);

    const stageCharacterContainer = document.createElement('div');
    stageCharacterContainer.classList.add('stage-character-records-container');

    const stageCharacterRecords = sessionData.stageCharacterRecords;

    function groupByStageAndTeamIdComposition(stageCharacterRecords) {
        const groupedByStageAndTeamIdComposition = {};

        Object.keys(stageCharacterRecords).forEach((stageId) => {
            const stageData = stageCharacterRecords[stageId];

            // Create a nested object for each stageId if it doesn't exist
            if (!groupedByStageAndTeamIdComposition[stageId]) {
                groupedByStageAndTeamIdComposition[stageId] = {};
            }

            // Now go through each combination within this stage
            Object.keys(stageData).forEach((combination) => {
                const parsedCombination = JSON.parse(combination);

                // Extract only the teamIds for each connect code
                const teamIds = Object.keys(parsedCombination).map(connectCode => parsedCombination[connectCode].teamId);

                // Convert the teamIds array into a string representation (e.g., "0011")
                const teamIdKey = teamIds.join('');

                // Initialize the grouping by teamId composition within the stage group
                if (!groupedByStageAndTeamIdComposition[stageId][teamIdKey]) {
                    groupedByStageAndTeamIdComposition[stageId][teamIdKey] = [];
                }

                // Push the combination and its corresponding data under the teamId key within the stage
                groupedByStageAndTeamIdComposition[stageId][teamIdKey].push({
                    combination: combination,
                    teamData: stageData[combination]
                });
            });
        });

        return groupedByStageAndTeamIdComposition;
    }

    const groupedByStageAndTeamIdComposition = groupByStageAndTeamIdComposition(stageCharacterRecords);

    // Loop through the grouped data by stageId and team composition
    Object.keys(groupedByStageAndTeamIdComposition).forEach(stageId => {
        const teamCompositions = groupedByStageAndTeamIdComposition[stageId];

        // Create the stageDiv once per stageId
        const stageDiv = document.createElement('div');
        stageDiv.classList.add('stage-info');

        // Add stage background
        const stagePath = getStagePath(stageId);
        const stageImage = document.createElement('img');
        stageImage.src = stagePath;
        stageImage.classList.add('stage-image');
        stageDiv.appendChild(stageImage);

        // Add stage title
        const stageName = stages.getStageName(stageId);
        const stageTitle = document.createElement('h3');
        stageTitle.textContent = `${stageName}`;
        stageDiv.appendChild(stageTitle);

        // Initialize a Set to keep track of processed team compositions for the current stageId
        const processedTeamCompositions = new Set();

        // Now loop through the team compositions for this stageId
        Object.keys(teamCompositions).forEach(teamComposition => {
            const teamCompositionData = teamCompositions[teamComposition];

            // Loop through each combination and data for this team composition
            teamCompositionData.forEach(({ combination, teamData }) => {
                const combinationDiv = document.createElement('div');
                combinationDiv.classList.add('combination-record');

                // Parse combination for player details
                const parsedCombination = JSON.parse(combination);
                const connectCodes = Object.keys(parsedCombination);
                const leftTeam = connectCodes.filter(code => parsedCombination[code].teamId === 0 || parsedCombination[code].teamId === 2);
                const rightTeam = connectCodes.filter(code => parsedCombination[code].teamId === 1);
                const teams = [leftTeam, rightTeam].sort();
                const sortedLeftTeam = teams[0];
                const sortedRightTeam = teams[1];

                // Create a unique identifier for this team composition (e.g., using sorted connectCodes)
                const teamCompositionKey = `${sortedLeftTeam.join(',')}-${sortedRightTeam.join(',')}`;

                // Check if the team composition has already been processed for the current stageId
                if (!processedTeamCompositions.has(teamCompositionKey)) {
                    // If not processed, add it to the set and create the player ovals
                    processedTeamCompositions.add(teamCompositionKey);

                    const combinationTitleDiv = document.createElement('div');
                    combinationTitleDiv.classList.add('combination-title');

                    // Add player ovals for the left and right teams
                    sortedLeftTeam.forEach(connectCode => {
                        const connectCodeLink = createConnectCodeLink(connectCode, parsedCombination[connectCode].teamId);
                        combinationTitleDiv.appendChild(connectCodeLink);
                    });
                    sortedRightTeam.forEach(connectCode => {
                        const connectCodeLink = createConnectCodeLink(connectCode, parsedCombination[connectCode].teamId);
                        combinationTitleDiv.appendChild(connectCodeLink);
                    });

                    // Append the combination title with the ovals to the combination div
                    combinationDiv.appendChild(combinationTitleDiv);
                }

                // Loop through the team data and create bars, records, and team icons
                Object.keys(teamData).forEach(leftTeam => {
                    const rightTeam = Object.keys(teamData[leftTeam])[0]; // Assume single right team entry
                    const record = teamData[leftTeam][rightTeam];

                    const totalGames = record.wins + record.losses;
                    const winPercentage = (record.wins / totalGames) * 100;
                    const lossPercentage = (record.losses / totalGames) * 100;

                    // Create the bar wrapper
                    const barWrapper = document.createElement('div');
                    barWrapper.classList.add('percentage-bar');

                    const leftTeamColor = record.teamColors.leftTeamColor;
                    const rightTeamColor = record.teamColors.rightTeamColor;

                    // Create the bars
                    const leftBar = document.createElement('div');
                    leftBar.style.width = `${winPercentage}%`;
                    leftBar.style.backgroundColor = leftTeamColor;

                    const rightBar = document.createElement('div');
                    rightBar.style.width = `${lossPercentage}%`;
                    rightBar.style.backgroundColor = rightTeamColor;

                    // Append bars to the wrapper
                    barWrapper.appendChild(leftBar);
                    barWrapper.appendChild(rightBar);

                    // Create team spans for player icons and connect codes
                    const leftTeamSpans = document.createElement('span');
                    const rightTeamSpans = document.createElement('span');

                    const addPlayerWithIcon = (connectCode, characterInfo, span) => {
                        const characterIcon = createCharacterIcon(characterInfo.characterId, characterInfo.color);
                        span.appendChild(characterIcon);  // Add character icon
                    };

                    sortedLeftTeam.forEach(connectCode => {
                        addPlayerWithIcon(connectCode, parsedCombination[connectCode], leftTeamSpans);
                    });
                    sortedRightTeam.forEach(connectCode => {
                        addPlayerWithIcon(connectCode, parsedCombination[connectCode], rightTeamSpans);
                    });

                    // Record text
                    const recordSpan = document.createElement('span');
                    recordSpan.textContent = `${record.wins} - ${record.losses}`;
                    recordSpan.classList.add('record-text');
                    
                    // Create tooltip for win/loss percentage
                    const tooltip = document.createElement('div');
                    tooltip.classList.add('tooltip');
                    tooltip.textContent = `${winPercentage.toFixed(0)}% / ${lossPercentage.toFixed(0)}%`;
                    tooltip.style.display = 'none'; // Hide by default
                    document.body.appendChild(tooltip);

                    // Event listeners for tooltip
                    recordSpan.addEventListener('mouseenter', () => {
                        tooltip.style.display = 'block';
                        const rect = recordSpan.getBoundingClientRect(); // Get the position of the recordSpan
                        tooltip.style.left = `${rect.right + 10}px`; // Position to the right of the recordSpan
                        tooltip.style.top = `${rect.top}px`; // Align vertically with the recordSpan
                    });

                    recordSpan.addEventListener('mouseleave', () => {
                        tooltip.style.display = 'none'; // Hide on mouse leave
                    });

                    // Append team spans and record to record div
                    const recordAndTeamsDiv = document.createElement('div');
                    recordAndTeamsDiv.classList.add('record-and-teams');
                    recordAndTeamsDiv.appendChild(leftTeamSpans);
                    recordAndTeamsDiv.appendChild(recordSpan);
                    recordAndTeamsDiv.appendChild(rightTeamSpans);

                    // Append bars and record/teams to the combination div
                    combinationDiv.appendChild(recordAndTeamsDiv); // Teams and record row
                });

                // Append combinationDiv to the stageDiv
                stageDiv.appendChild(combinationDiv);
            });
        });

        // Append the stageDiv (one per stageId) to the stageCharacterContainer
        stageCharacterContainer.appendChild(stageDiv);
    });

    // Append stageCharacterContainer to the modal
    modal.appendChild(stageCharacterContainer);

    
    modalBackground.appendChild(modal);
    document.body.appendChild(modalBackground);    
}

module.exports = {
    createCollapsibleSection,
    highlightMatchingColumns,
    appendCollapsibleSection
};