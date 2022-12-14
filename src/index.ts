import { readdir, rm, copyFile, readFile, writeFile } from 'fs/promises';

import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import inquirer from 'inquirer';

import rules from './rules.json';

const unEndingLetter = (word: string) => {
	const lastChar = word[word.length - 1];
	switch (lastChar) {
		case 'ם':
			return `${word.slice(0, -1)}מ`;
		case 'ן':
			return `${word.slice(0, -1)}נ`;
		case 'ך':
			return `${word.slice(0, -1)}כ`;
		case 'ף':
			return `${word.slice(0, -1)}פ`;
		case 'ץ':
			return `${word.slice(0, -1)}צ`;
		default:
			return word;
	}
};

const replaceWord = (text: string, word: string, replacement: string, endings: string[] = []) => {
	return text.replace(
		new RegExp(
			`(?<=^|\\s)${word}(?=(${endings
				.reduce((prev, ending) => `${prev}|${ending}`, '')
				.substring(1)})(\\s|$))`,
			'g',
		),
		replacement,
	);
};

(async () => {
	if (process.argv.length > 2 && process.argv[2] === '-e') {
		console.log('\nAdding a new word to the dictionary:\n');
		const { word, replacement, endings } = (await inquirer.prompt([
			{
				name: 'word',
				message: 'Enter your word:',
			},
			{
				name: 'replacement',
				message: 'Enter the replacement:',
			},
			{
				type: 'checkbox',
				name: 'endings',
				message: 'Choose valid endings:',
				choices: rules.endings,
			},
		])) as { word: string; replacement: string; endings: string[] };

		const json = JSON.parse(await (await readFile('./src/rules.json')).toString());
		if (endings.length > 0)
			json.dictionary.push({
				word,
				replacement,
				endings,
			});
		else
			json.dictionary.push({
				word,
				replacement,
			});
		writeFile('./src/rules.json', JSON.stringify(json, null, 2));
	} else {
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.readFile(rules.file);

		console.log('Backuping File...');

		const backups = await (await readdir('./backups')).map((file) => file.slice(0, -5)).sort();
		for (let i = 0; i < backups.length - 3; i += 1) rm(`./backups/${backups[i]}.xlsx`);

		await copyFile(rules.file, `./backups/${dayjs().format('YYYY-MM-DD[T]HH[h]mm[m]ss[s]')}.xlsx`);

		console.log('Working...');

		workbook.eachSheet((worksheet) => {
			worksheet.eachRow((row) => {
				row.eachCell((cell) => {
					if (typeof cell.value === 'string') {
						rules.dictionary.forEach((rule) => {
							// eslint-disable-next-line no-param-reassign
							cell.value = replaceWord(cell.value as string, rule.word, rule.replacement);
							// eslint-disable-next-line no-param-reassign
							cell.value = replaceWord(
								cell.value as string,
								unEndingLetter(rule.word),
								unEndingLetter(rule.replacement),
								rule.endings || [],
							);
						});
					}
				});
			});
		});
		await workbook.xlsx.writeFile(rules.file);

		console.log('Done :)');
	}
})();
