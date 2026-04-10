/**
 * HTML / SVG 转高清 PNG 截图工具
 *
 * 使用 html-to-image 库将 AI 生成的 HTML 或 SVG 片段
 * 渲染后截图为透明背景 PNG，并触发浏览器下载。
 */

import { LocalTool } from "./types";

export const htmlSvgToImageTool: LocalTool = {
  type: "local",
  name: "html_svg_to_image",
  displayName: "HTML/SVG 转截图",
  description:
    "将 AI 生成的 HTML 或 SVG 代码片段渲染后截图，输出为保留透明度的高清 PNG 文件并触发浏览器下载。" +
    "当用户希望将可视化内容（图表、图形、海报、卡片、SVG 插图等）导出为图片时使用。" +
    "支持内联 CSS 样式；width/height 参数控制渲染尺寸；pixel_ratio=2 可生成 2 倍高清图。",
  parameters: {
    type: "object",
    properties: {
      html: {
        type: "string",
        description:
          "完整的 HTML 或 SVG 代码片段。" +
          "可包含内联 <style> 标签及内联样式。" +
          "若内容是纯 SVG，可直接传入 <svg>...</svg> 字符串。" +
          "背景默认透明，如需不透明背景请在代码中自行设置 background-color。",
      },
      width: {
        type: "number",
        description: "渲染容器宽度（像素），默认 1600",
        default: 1600,
      },
      height: {
        type: "number",
        description:
          "渲染容器高度（像素），默认 1200。" +
          "若传 0 则自动根据内容高度截取（不裁剪）。",
        default: 1200,
      },
      pixel_ratio: {
        type: "number",
        description:
          "像素比（分辨率倍数），默认 2（即输出为 2× 高清图）。最大建议 4。",
        default: 2,
      },
      filename: {
        type: "string",
        description: "下载文件名（不含扩展名），默认 image",
        default: "image",
      },
    },
    required: ["html"],
  },

  execute: async (args) => {
    if (typeof window === "undefined") {
      return "此工具只能在浏览器端执行。";
    }

    const html = String(args.html ?? "");
    const width = Number(args.width ?? 1600);
    const rawHeight = Number(args.height ?? 1200);
    const pixelRatio = Math.min(Math.max(Number(args.pixel_ratio ?? 2), 1), 4);
    const filename = String(args.filename ?? "image").replace(/\.png$/i, "");

    if (!html.trim()) {
      return "html 参数不能为空。";
    }

    // 用一个 0×0 的 wrapper 遮住内容，防止用户看到渲染中的元素。
    // 注意：不能对 container 本身用 position:fixed + 大负数偏移，因为
    // html-to-image 会克隆元素的完整计算样式（包含 top/left），
    // 克隆体在 SVG foreignObject 中渲染时内容会偏移到画布之外，导致纯透明图片。
    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;pointer-events:none;z-index:-9999;";

    const container = document.createElement("div");
    container.style.cssText = [
      `width:${width}px`,
      rawHeight > 0 ? `height:${rawHeight}px` : "height:auto",
      "overflow:hidden",
      "background:transparent",
    ].join(";");

    container.innerHTML = html;
    wrapper.appendChild(container);
    document.body.appendChild(wrapper);

    try {
      // 等待两帧，确保浏览器完成 layout/paint（特别是 SVG foreignObject）
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );

      const actualHeight =
        rawHeight > 0 ? rawHeight : container.scrollHeight || 600;

      if (rawHeight === 0) {
        container.style.height = `${actualHeight}px`;
        // 再等一帧
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }

      const { toPng } = await import("html-to-image");

      const dataUrl = await toPng(container, {
        pixelRatio,
        width,
        height: actualHeight,
        backgroundColor: undefined, // 保留透明度
        skipAutoScale: false,
        cacheBust: true,
      });

      // 触发下载
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${filename}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return (
        `PNG 图片"${filename}.png"已成功生成（${width}×${actualHeight}px，` +
        `${pixelRatio}× 高清，保留透明度）。` +
        `请提示用户：在电脑浏览器中可查看右上角（或底部栏）的下载提示；` +
        `在手机浏览器中请查看顶部/底部的下载通知或弹窗，点击即可保存图片。`
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return `截图生成失败：${msg}`;
    } finally {
      document.body.removeChild(wrapper);
    }
  },
};
