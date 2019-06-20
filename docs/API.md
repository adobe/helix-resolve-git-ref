<a name="main"></a>

## main(owner, repo, [ref]) ⇒ <code>object</code> \| <code>string</code> \| <code>object</code>
This is the main function. It resolves the specified reference to the corresponding
sha of the HEAD commit at `ref`.

**Kind**: global function  
**Returns**: <code>object</code> - result<code>string</code> - result.sha the sha of the HEAD commit at `ref`<code>object</code> - result.fqRef the fully qualified name of `ref`
                               (e.g. `refs/heads/<branch>` or `refs/tags/<tag>`)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| owner | <code>string</code> |  | GitHub organization or user |
| repo | <code>string</code> |  | GitHub repository name |
| [ref] | <code>string</code> | <code>&quot;master&quot;</code> | git reference (branch or tag name) |

