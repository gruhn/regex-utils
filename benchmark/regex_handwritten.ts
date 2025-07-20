import fs from 'fs'

function* readHandWrittenDataset() {
  // dataset obtained from regex101.com using this script:
  // https://github.com/dataunitylab/semantic-regex/blob/ece59e827cc05b907883aace30d72e02e31e2a9b/download_patterns.sh
  const jsonStr = fs.readFileSync('./benchmark/regex-dataset.json', 'utf-8')

  for (const item of JSON.parse(jsonStr)) {
    if (item.flavor === "javascript" && item.flags === "") {
      try {
        yield new RegExp(item.regex) // , item.flags)
      } catch (e) {
        console.warn('regex dataset: skipping invalid regex')
      }
    }
  }
}

export default [...readHandWrittenDataset()]

