# <% tp.file.title %>

```base
filters:
  and:
    - file.inFolder(this.file.folder)
    - file.name != this.file.name
views:
  - type: table
    name: Table
    order:
      - aliases
      - file.mtime
      - file.name
    sort:
      - property: file.path
        direction: ASC
```