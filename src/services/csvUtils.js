export const exportToCSV = (data, filename) => {
    if (!data || !data.length) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => {
            const cell = row[header] === null || row[header] === undefined ? '' : row[header];
            return `"${String(cell).replace(/"/g, '""')}"`;
        }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

export const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const [headerLine, ...lines] = text.split('\n');
                const headers = headerLine.split(',').map(h => h.trim());

                const result = lines
                    .filter(line => line.trim())
                    .map(line => {
                        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(val => val.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
                        const obj = {};
                        headers.forEach((header, index) => {
                            if (values[index] !== undefined) {
                                // Try to convert to number if possible and if it looks like a number
                                const num = Number(values[index]);
                                obj[header] = !isNaN(num) && values[index] !== '' ? num : values[index];
                            }
                        });
                        // Ensure ID is unique if not present
                        if (!obj.id) obj.id = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                        return obj;
                    });
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsText(file);
    });
};
