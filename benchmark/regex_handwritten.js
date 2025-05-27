import fs from 'fs'

function* readHandWrittenDataset() {
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

