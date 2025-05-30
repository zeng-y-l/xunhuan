# xunhuan

小而快的迭代器库。

```js
import * as X from 'xunhuan'

X.range(1000).c(
  X.filter(x => x % 2 === 0),
  X.map(x => x * x),
  X.skipWhile(x => x < 1000),
  X.sum,
)
```

## 特性

- 小：压缩后 <4kB。且用 `Iter.c` 方法实现链式调用，使**所有**方法都支持 tree shaking，例如上面代码构建并压缩后 <0.7kB。
- 快：受 Rust 启发，使用内部迭代提高性能，一些方法还有专门优化。根据 benchmark，本库**比类似库都快**，仅次于原生的循环。
- 每个方法都有文档与**经过测试的示例**。加上全面的模糊测试，代码覆盖率达到 100%。
- 自带**键**的支持，无需用元组等模拟键值对。`filter` 等方法会保留原有的键。
- 由 TypeScript 写成，可以自动推导类型。
- 迭代器惰性求值、不可变，支持无限长。
- 无运行时依赖。

## Benchmark

```txt
native loop - test/main.bench.ts > flatMap
  1.99x faster than xunhuan
  2.48x faster than lodash
  2.90x faster than iterare
  3.02x faster than lazy.js
  3.04x faster than immutable
  5.54x faster than extra-iterable
  12.88x faster than native array method

native loop - test/main.bench.ts > range
  16.75x faster than xunhuan
  22.28x faster than lazy.js
  25.41x faster than lodash
  26.94x faster than immutable
  75.79x faster than extra-iterable

native loop - test/main.bench.ts > zip
  18.00x faster than xunhuan
  28.99x faster than lazy.js
  30.01x faster than iterare
  30.46x faster than lodash
  57.78x faster than extra-iterable
  98.16x faster than immutable
```
