const fs = require('fs');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');

// Read the CSV file
const data = [];

fs.createReadStream('healthcare_dataset.csv')
  .pipe(csv())
  .on('data', (row) => {
    data.push(row);
  })
  .on('end', () => {
    console.log('CSV file loaded successfully');
    console.log(`Total records: ${data.length}`);
    
    // Process the data
    const processedData = processData(data);
    
    // Export to new CSV file
    exportToCSV(processedData);
  })
  .on('error', (error) => {
    console.error('Error reading CSV file:', error);
  });

// Function to process data
function processData(data) {
  return data.map((row) => {
    // Create a new object for processed data
    let processed = { ...row };

    // Handle missing values
    processed = handleMissingValues(processed);

    // Convert data types
    processed = convertDataTypes(processed);

    // Create derived features
    processed = createDerivedFeatures(processed);

    return processed;
  });
}

// Function to handle missing values
function handleMissingValues(row) {
  const processed = { ...row };
  
  // Replace empty strings, "null", "N/A", "NA" with empty string or default values
  Object.keys(processed).forEach((key) => {
    const value = processed[key];
    if (value === '' || value === 'null' || value === 'N/A' || value === 'NA' || value === undefined) {
      processed[key] = '';
    }
  });

  return processed;
}

// Function to convert data types
function convertDataTypes(row) {
  const processed = { ...row };

  // Convert dates
  const dateColumns = ['Admission_Date', 'Discharge_Date', 'DOB', 'Date_of_Birth'];
  dateColumns.forEach((col) => {
    if (processed[col] && processed[col] !== '') {
      // Ensure date format is consistent (YYYY-MM-DD)
      const date = new Date(processed[col]);
      if (!isNaN(date)) {
        processed[col] = date.toISOString().split('T')[0];
      }
    }
  });

  // Convert numeric columns
  const numericColumns = ['Age', 'Billing_Amount', 'Medical_Condition'];
  numericColumns.forEach((col) => {
    if (processed[col] && processed[col] !== '') {
      const num = parseFloat(processed[col]);
      if (!isNaN(num)) {
        processed[col] = num;
      }
    }
  });

  return processed;
}

// Function to create derived features
function createDerivedFeatures(row) {
  const processed = { ...row };

  // Calculate Length of Stay
  const admissionDate = row['Date of Admission'] || row['admission_date'];
  const dischargeDate = row['Discharge Date'] || row['discharge_date'];

  if (admissionDate && dischargeDate && admissionDate !== '' && dischargeDate !== '') {
    const admission = new Date(admissionDate);
    const discharge = new Date(dischargeDate);
    
    if (!isNaN(admission) && !isNaN(discharge)) {
      const lengthOfStay = Math.floor((discharge - admission) / (1000 * 60 * 60 * 24));
      processed['Length_of_Stay'] = lengthOfStay >= 0 ? lengthOfStay : '';
    }
  } else {
    processed['Length_of_Stay'] = '';
  }

  // Create Age Groups
  const age = parseFloat(row['Age'] || row['age']);
  if (!isNaN(age)) {
    if (age >= 0 && age <= 18) {
      processed['Age_Group'] = '0-18';
    } else if (age > 18 && age <= 40) {
      processed['Age_Group'] = '19-40';
    } else if (age > 40 && age <= 65) {
      processed['Age_Group'] = '41-65';
    } else if (age > 65) {
      processed['Age_Group'] = '65+';
    }
  } else {
    processed['Age_Group'] = '';
  }

  return processed;
}

// Function to remove Name and Doctor (as we don't need them) then export to csv
function exportToCSV(data) {
  if (data.length === 0) {
    console.error('No data to export');
    return;
  }

  // Remove Name and Doctor attributes from each row
  const cleanedData = data.map((row) => {
    const { Name, Doctor, ...rest } = row; // destructuring to exclude Name and Doctor
    return rest;
  });

  // Get all column names from the first record after removing Name and Doctor
  const headers = Object.keys(cleanedData[0]).map((key) => ({ id: key, title: key }));

  const csvWriter = createObjectCsvWriter({
    path: 'healthcare_dataset_processed_2.csv',
    header: headers,
  });

  csvWriter
    .writeRecords(cleanedData)
    .then(() => {
      console.log('✓ Data processed and exported to healthcare_dataset_processed.csv');
      console.log(`Total records processed: ${cleanedData.length}`);
      console.log('\nNew columns added:');
      console.log('  - Length_of_Stay (calculated from Admission_Date and Discharge_Date)');
      console.log('  - Age_Group (0-18, 19-40, 41-65, 65+)');
      console.log('✓ Removed columns: Name, Doctor');
    })
    .catch((error) => {
      console.error('Error writing CSV file:', error);
    });
}

    

