class MangaForFree extends ComicSource {

    name = "MangaForFree"
    key = "mangaforfree"
    version = "0.2.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/meaninglesslyy/venara@main/mangaforfree.js"

    base = "https://mangaforfree.net"

    // ① 抓 HTML 页面用的头：不带 X-Requested-With（跟官方源一致）
    pageHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": this.base + "/",
        }
    }

    slugFromUrl(url) {
        return url.replace(/\/+$/, "").split("/").pop()
    }

    parseComicItem(el) {
        // 兼容 Madara 搜索页两种常见结构
        let thumb = el.querySelector(".tab-thumb img, .item-thumb img, .thumb img, img")
        let cover = thumb?.attributes["data-src"]
            || thumb?.attributes["data-lazy-src"]
            || thumb?.attributes["src"]
            || ""
        let linkEl = el.querySelector(".tab-summary h3 a, .item-summary h3 a, h3 a, a")
        let url = linkEl?.attributes["href"] || ""
        let title = linkEl?.text?.trim() || ""
        if (!url || !title) return null
        return {
            id: this.slugFromUrl(url),
            title: title,
            subTitle: null,
            cover: cover,
        }
    }

    // ==================== 搜索（HTML 搜索页，带封面） ====================
    search = {
        load: async (keyword, options, page) => {
            // Madara 标准搜索 URL，支持分页
            let url = `${this.base}/page/${page}/?s=${encodeURIComponent(keyword)}&post_type=wp-manga`
            if (page <= 1) url = `${this.base}/?s=${encodeURIComponent(keyword)}&post_type=wp-manga`

            let res = await Network.get(url, this.pageHeaders())
            if (res.status !== 200) throw `Invalid status code: ${res.status}`

            let doc = new HtmlDocument(res.body)
            let comics = []
            doc.querySelectorAll(".c-tabs-item__content, .page-item-detail").forEach(el => {
                let c = this.parseComicItem(el)
                if (c) comics.push(c)
            })
            doc.dispose()

            // 分页：Madara 的分页器
            let maxPage = 1
            // TODO: 从分页器里算（验证后我再补）
            return { comics, maxPage }
        },
        optionList: []
    }

    // ==================== 详情 + 章节 ====================
    comic = {
        loadInfo: async (id) => {
            let res = await Network.get(`${this.base}/manga/${id}/`, this.pageHeaders())
            if (res.status !== 200) throw `Invalid status code: ${res.status}`

            let doc = new HtmlDocument(res.body)

            let title = doc.querySelector(".post-title h1")?.text?.trim() || id
            let coverEl = doc.querySelector(".summary_image img")
            let cover = coverEl?.attributes["data-src"]
                || coverEl?.attributes["data-lazy-src"]
                || coverEl?.attributes["src"]
                || ""
            let desc = doc.querySelector(".summary__content")?.text?.trim()
                || doc.querySelector(".manga-excerpt")?.text?.trim()
                || ""

            let authors = doc.querySelectorAll(".author-content a").map(a => a.text.trim())
            let tags = doc.querySelectorAll(".genres-content a").map(a => a.text.trim())
            let status = doc.querySelector(".post-status .summary-content")?.text?.trim()

            // ② 章节：同时兼容 #chapterlist 和 ul.main.version-chap，并按 href 去重
            let chapters = new Map()
            let seen = new Set()
            doc.querySelectorAll(
                "#chapterlist li.wp-manga-chapter > a, ul.main.version-chap li.wp-manga-chapter > a"
            ).forEach(a => {
                let href = a.attributes["href"]
                let name = a.text.trim()
                if (!href || !name || seen.has(href)) return
                seen.add(href)
                chapters.set(this.slugFromUrl(href), name)
            })
            doc.dispose()

            if (!chapters.size) throw "未解析到章节列表：请把详情页前3000字符日志发我"

            return new ComicDetails({
                id: id,                    // ③ 补上 id
                title,
                cover,
                description: desc,
                tags: {
                    "作者": authors,
                    "状态": status ? [status] : [],
                    "标签": tags,
                },
                chapters,
            })
        },

        loadEp: async (comicId, epId) => {
            let res = await Network.get(`${this.base}/manga/${comicId}/${epId}/`, this.pageHeaders())
            if (res.status !== 200) throw `Invalid status code: ${res.status}`

            let doc = new HtmlDocument(res.body)
            let images = []
            doc.querySelectorAll(".reading-content img").forEach(img => {
                let src = img.attributes["data-src"]
                    || img.attributes["data-lazy-src"]
                    || img.attributes["src"]
                if (src) images.push(src)
            })
            doc.dispose()

            if (!images.length) throw "未解析到图片"
            return { images }
        },
    }

    // ==================== 分类（v0.2 暂留空） ====================
    category = { title: "分类", parts: [] }
    categoryComics = {
        load: async (category, param, options, page) => ({ comics: [], maxPage: 1 })
    }

    settings = {}
}
