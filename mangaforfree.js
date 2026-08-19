class MangaForFree extends ComicSource {

    name = "MangaForFree"
    key = "mangaforfree"
    version = "0.1.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/你的用户名/你的仓库@main/mangaforfree.js"  // TODO: 发布后填

    base = "https://mangaforfree.net"
    ajaxUrl = "https://mangaforfree.net/wp-admin/admin-ajax.php"

    get headers() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Referer": this.base + "/",
            "X-Requested-With": "XMLHttpRequest",
        }
    }

    formHeaders() {
        return {
            ...this.headers,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        }
    }

    // URL 取最后一段 slug
    slugFromUrl(url) {
        return url.replace(/\/+$/, "").split("/").pop()
    }

    // ==================== 搜索 ====================
    search = {
        load: async (keyword, options, page) => {
            let res = await Network.post(
                this.ajaxUrl,
                this.formHeaders(),
                `action=wp-manga-search-manga&title=${encodeURIComponent(keyword)}`
            )
            if (res.status !== 200) throw `Invalid status code: ${res.status}`

            let data = JSON.parse(res.body)
            let comics = (data.data || []).map(item => ({
                id: this.slugFromUrl(item.url),   // love-quest
                title: item.title,
                subTitle: null,
                cover: "",
            }))
            return { comics, maxPage: 1 }        // 自动补全无分页，最多约 12 条
        },
        optionList: []
    }

    // ==================== 详情 + 章节 ====================
    comic = {
        loadInfo: async (id) => {
            let res = await Network.get(`${this.base}/manga/${id}/`, this.headers)
            if (res.status !== 200) throw `Invalid status code: ${res.status}`

            let doc = new HtmlDocument(res.body)

            // 标题 / 封面 / 简介
            let title = doc.querySelector(".post-title h1")?.text?.trim() || id
            let coverEl = doc.querySelector(".summary_image img")
            let cover = coverEl?.attributes["data-src"]
                || coverEl?.attributes["data-lazy-src"]
                || coverEl?.attributes["src"]
                || ""
            let desc = doc.querySelector(".summary__content")?.text?.trim()
                || doc.querySelector(".manga-excerpt")?.text?.trim()
                || ""

            // 作者/分类/状态（尽力而为，抓不到不影响主流程）
            let authors = doc.querySelectorAll(".author-content a").map(a => a.text.trim())
            let tags = doc.querySelectorAll(".genres-content a").map(a => a.text.trim())
            let status = doc.querySelector(".post-status .summary-content")?.text?.trim()

            // 章节：直接解析详情页 HTML（已验证 62 条）
            // 用 "li > a" 只取主链接，过滤 NEW 角标里的重复 <a>
            let chapters = new Map()
            doc.querySelectorAll("ul.main.version-chap li.wp-manga-chapter > a").forEach(a => {
                let href = a.attributes["href"]
                let name = a.text.trim()
                if (!href || !name) return
                chapters.set(this.slugFromUrl(href), name)
            })
            doc.dispose()

            if (!chapters.size) throw "未解析到章节列表"

            return new ComicDetails({
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
            let res = await Network.get(`${this.base}/manga/${comicId}/${epId}/`, this.headers)
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

    // ==================== 分类（v0.1 留空，之后再补） ====================
    category = { title: "分类", parts: [] }
    categoryComics = {
        load: async (category, param, options, page) => ({ comics: [], maxPage: 1 })
    }

    settings = {}
}