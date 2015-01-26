$(function ()
{
    var socket = io();

    var hash = document.URL.substr(document.URL.indexOf('#'));

    if(hash[0] == '#') {
        var tweets = $('#tweets');

        socket.emit('register', hash);

        socket.on('tweet', function (data)
        {
            var domTweet = '<li><div class="tweet">' +
                '<div class="pic">' +
                '<img src="' + data.user.image + '" />' +
                '</div>' +
                '<div class="content">' +
                '<h1>' + data.user.name + '</h1>' +

                '<p><span>@' + data.user.screen_name + '</span>&nbsp;-&nbsp;' + data.text + '</p>' +
                '<div class="underline"></div>' +
                '</div>' +
                '</div></li>';

            tweets.prepend(domTweet);

            if (tweets.find('li').size() > 10)
            {
                tweets.find('li:last').remove();
            }
        });
    }
    else
    {
        $('#tweets-container').css('display', 'none');
        $('#battle').css('margin-right', '0');
    }

    var colors = [
        { // Blue
            main: '2196F3',
            back: 'BBDEFB'
        },
        { // Orange
            main: 'FF9800',
            back: 'FFE0B2'
        },
        { // Green
            main: '4CAF50',
            back: 'C8E6C9'
        },
        { // Red
            main: 'F44336',
            back: 'FFCDD2'
        },
        { // Teal
            main: '009688',
            back: 'B2DFDB'
        },
        { // Yellow
            main: 'FFEB3B',
            back: 'FFF9C4'
        },
        { // Light Green
            main: '8BC34A',
            back: 'DCEDC8'
        },
        { // Pink
            main: 'E91E63',
            back: 'F8BBD0'
        },
        { // Indigo
            main: '3F51B5',
            back: 'C5CAE9'
        },
        { // Deep Orange
            main: 'FF5722',
            back: 'FFCCBC'
        },
        { // Purple
            main: '673AB7',
            back: 'D1C4E9'
        },
        { // Cyan
            main: '00BCD4',
            back: 'B2EBF2'
        },
        { // Lime
            main: 'CDDC39',
            back: 'F0F4C3'
        },
        { // Light Green
            main: '8BC34A',
            back: 'DCEDC8'
        },
        { // Amber
            main: 'FFC107',
            back: 'FFECB3'
        }
    ];

    function getColor (hash)
    {
        var color,
            h = hash.toLowerCase();
        $.each(colors, function (i, v)
        {
            if (!v._hash && !color)
            {
                color = v; // grab the first unused color
            }

            if (v._hash && v._hash === h)
            {
                color = v;
                return false;
            }
        });

        color._hash = h;
        return color;
    }


    socket.on('battle', function (data)
    {
        var max = 2000,
            hashArr = [];

        $.each(data, function (k, v)
        {
            if (k !== '_time')
            {
                max = Math.max(max, v);
                hashArr.push({hash: k, value: v});
            }
        });

        hashArr.sort(function (a, b)
        {
            return b.value - a.value;
        });

        var ranking = $('#ranking');

        $.each(hashArr, function (i, v)
        {
            var id = ('rank-' + v.hash.toLowerCase()).replace('#', '_'),
                elem = $('#' + id);

            if (!elem.length)
            {
                elem = $('<div class="rank" id="' + id + '"></div>');
                var inner = $('<div class="rank-inner"></div>');
                inner.append('<div class="index"></div>');
                inner.append('<span class="hash">' + v.hash.toUpperCase() + '</span>');

                inner.append('<div class="score"></div>');
                inner.append('<div class="score" style="visibility: hidden; height: 0"></div>');
                elem.append(inner);

                var color = getColor(v.hash);
                inner.css('border-bottom-color', '#' + color.main);

                ranking.find('div:last').before(elem);
            }

            elem.css('order', i + 1);
            if(i === 0) {
                elem.css('width', '100%');
            }
            else if(i === 1 || i === 2) {
                elem.css('width', '50%');
            }
            else {
                elem.css('width', 'inherit');
            }

            elem.find('.index').html(i + 1);
            elem.find('.score:first').html(v.value);
            elem.find('.score:last').html('000000000000000'.substr(0, (v.value + '').length));
        });
    });


    /**************************************************************************************************
     * Roll
     **************************************************************************************************/
    var graphHash = {},
    series = [];
    var graph,
        xAxis;


    function addRoll(data) {
        // Check if new keys are present
        $.each(data, function (k)
        {
            if (!graphHash[k] && k !== '_time')
            {
                graphHash[k] = [];

                function first (obj)
                {
                    //noinspection LoopStatementThatDoesntLoopJS
                    for (var a in obj)
                    {
                        if (obj.hasOwnProperty(a))
                        {
                            return a;
                        }
                    }
                }

                var key = first(graphHash);
                if (key) // first value
                {
                    for (var i = 0; i < graphHash[key].length; i++)
                    {
                        graphHash[k].push({x: graphHash[key][i].x, y: 0})
                    }
                }

                var color = getColor(k);
                series.push({color: '#' + color.back, data: graphHash[k]});
            }
        });

        $.each(data, function (k, v)
        {
            if (k !== '_time')
            {
                graphHash[k].push({x: data._time, y: v});

                if (graphHash[k].length > 72)       // Max values
                {
                    graphHash[k].shift();
                }
            }
        });


        series.sort(function (a, b)
        {
            return a.data[a.data.length - 1].y - b.data[b.data.length - 1].y;
        });

        if (!graph)
        {
            graph = new Rickshaw.Graph({
                element: document.querySelector("#chart"),
                //width: 580,
                //height: 250,
                renderer: 'area',
                offset: 'expand',
                interpolation: 'linear',
                series: series
            });

            xAxis = new Rickshaw.Graph.Axis.Time({
                graph: graph,
                ticksTreatment: 'glow',
                timeFixture: new Rickshaw.Fixtures.Time.Local()
            });

        }

        graph.render();
        //xAxis.render();
    }
    socket.on('roll', function (data)
    {
        addRoll(data);
    });
    socket.on('rolls', function (data)
    {
        $.each(data, function(i, v){
            addRoll(v);
        });
    });

    $(document).ready(function ()
    {
        var lastShowed = 0;
        function setSvgColor(svg, main, back) {
            for( var i = 1; i < 10; i++)
            {
                var svgItem = svg.getElementById("deco-" + i);
                if (svgItem)
                    svgItem.setAttribute("fill", main);
            }
            var bouclier = svg.getElementById("Bouclier");
            if (bouclier)
                bouclier.setAttribute("fill", back);
            var bouclierExt = svg.getElementById("BouclierExt");
            if (bouclierExt)
                bouclierExt.setAttribute("stroke", main);
        }

        function animate ()
        {


            var color = colors[lastShowed++];
            if(!color._hash) {
                color = colors[0];
                lastShowed = 1;
            }

            if (Math.random() > 0.5)
            {
                setSvgColor($('.sw.left object')[0].contentDocument, '#' + color.main, '#' + color.back);

                $('.sw.left').animate({left: '150%'}, 10000, 'linear', function ()
                {
                    $('.sw.left').css('left', '-80%');
                    animate();
                })
            }
            else
            {
                setSvgColor($('.sw.right object')[0].contentDocument, '#' + color.main, '#' + color.back);
                $('.sw.right').animate({left: '-80%'}, 10000, 'linear', function ()
                {
                    $('.sw.right').css('left', '150%');
                    animate();
                })
            }
        }

        animate();
    });
});
