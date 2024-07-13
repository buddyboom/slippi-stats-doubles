const { existsSync, readdirSync, lstatSync } = require('fs');
const { join } = require('path');

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

const getCharacterIconPath = (characterId, color) => {
    const iconPath = path.join(__dirname, `../../images/characters/${characterId}/${color}/stock.png`);
    return iconPath;
};

// // Function to get the stored file path (for later use)
// function getStoredExePath() {
//     return localStorage.getItem('selectedExePath');
// }

function saveSelectedFolderToLocalStorage(folderPath) {
    if (folderPath === null) {
        localStorage.removeItem('selectedFolder'); // Remove the key if folderPath is null
    } else {
        localStorage.setItem('selectedFolder', folderPath);
    }
}

// Function to retrieve selected folder path from localStorage
function getSelectedFolderFromLocalStorage() {
    return localStorage.getItem('selectedFolder');
}

module.exports = {
    convertUTCtoLocalTime,
    findFilesInDir,
    getCharacterIconPath,
    saveSelectedFolderToLocalStorage,
    getSelectedFolderFromLocalStorage
};