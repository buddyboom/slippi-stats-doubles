// processedFilesModule.js
const ProcessedFilesModule = (() => {
    const processedFiles = new Set();

    const addProcessedFile = (fileName, data) => {
        console.log("adding file "+fileName)
        processedFiles.add({ fileName, data });
    };

    const hasProcessedFile = (fileName) => {
        for (let file of processedFiles) {
            if (file.fileName === fileName) {
                return true;
            }
        }
        return false;
    };
    
    const processedFilesSize = () => {
        return processedFiles.size;
    };

    const getSortedProcessedFiles = () => {
        return [...processedFiles].sort((a, b) => new Date(a.data.timestamp) - new Date(b.data.timestamp));
    };

    return {
        addProcessedFile,
        hasProcessedFile,
        processedFilesSize,
        getSortedProcessedFiles
    };
})();
module.exports = { ProcessedFilesModule };