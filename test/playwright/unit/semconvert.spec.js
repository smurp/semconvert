import { test, expect } from '@playwright/test';
import { semconvert } from '../../../lib/semconvert.js';

// Sample RDF Turtle input data
const turtleInput = `
@prefix : <http://example.com/> .
:S1 :p1 "Object1" .
:S2 :p2 "Object2" .
:S3 :p3 "Object3" .
`;

// Expected output in another format, such as JSON
const expectedJsonOutput = {
  labels: ['p1', 'p2', 'p3'],
  datasets: [
    { label: 'S1', data: ['Object1', , ] },
    { label: 'S2', data: [ null, 'Object2', ] },
    { label: 'S3', data: [ null, null , 'Object3'] }
  ]
};

// Test case to verify conversion from Turtle to JSON
test.describe('semconvert', () => {
  test('should convert Turtle RDF input to JSON', async () => {
    // Set up options for conversion
    const options = {
      inputFormat: 'text/turtle',
      outputFormat: 'application/json',
      jsonIndent: 2,
      stripUrls: true
    };

    // Run the semconvert function
    const result = await new Promise((resolve, reject) => {
      semconvert(turtleInput, (err, res) => {
        if (err) reject(err);
        resolve(res);
      }, options);
    });

    // Parse the result to compare
    const parsedResult = JSON.parse(result);
    expect(parsedResult).toEqual(expectedJsonOutput);
  });

  // Test case to verify conversion to CSV format
  test('should convert Turtle RDF input to CSV', async () => {
    const options = {
      inputFormat: 'text/turtle',
      outputFormat: 'text/csv'
    };

    const expectedCsvOutput = `,p1,p2,p3
S1,Object1,,
S2,,Object2,
S3,,,Object3
`;

    const result = await new Promise((resolve, reject) => {
      semconvert(turtleInput, (err, res) => {
        if (err) reject(err);
        resolve(res);
      }, options);
    });

    expect(result).toEqual(expectedCsvOutput);
  });

  // Test case for invalid input format
  test('should handle invalid input format gracefully', async () => {
    const invalidTurtleInput = `
    :S1 :p1 "Object1";
    :p2 "Object2";
    :p3 .
    `;

    const options = {
      inputFormat: 'text/turtle',
      outputFormat: 'application/json',
      jsonIndent: 2
    };

    const result = await new Promise((resolve, reject) => {
      semconvert(invalidTurtleInput, (err, res) => {
        if (err) reject(err);
        resolve(res);
      }, options);
    });

    expect(result).toContain('Error parsing input data');
  });
});
