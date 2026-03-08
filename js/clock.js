document.addEventListener('DOMContentLoaded', () => {
    // 全てのタグを取得
    const tags = document.querySelectorAll('.tag');
    
    // 各タグIDと、対応する表示エリアのIDを紐付け
    const containers = {
        'news-tag': document.getElementById('news-feed-container'),
        'study-tag': document.getElementById('study-container'),
        'tolk-tag': document.getElementById('tolk-screen'),
        'calendar-tag': document.getElementById('calendar-container'),
    };

    tags.forEach(tag => {
        tag.addEventListener('click', () => {
            // 1. 全てのタグから 'active' クラスを外し、クリックされたものだけ付ける（見た目の変更）
            tags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');

            // 2. 一旦すべてのコンテナを非表示（display: none）にする
            Object.values(containers).forEach(container => {
                if (container) {
                    container.style.display = 'none';
                }
            });

            // 3. クリックされたタグに対応するコンテナだけを表示（display: block）する
            const targetContainer = containers[tag.id];
            if (targetContainer) {
                targetContainer.style.display = 'block';
            } else {
                // othersなど、対応する画面がない場合
                console.log('表示するコンテンツが設定されていません');
            }
        });
    });
});